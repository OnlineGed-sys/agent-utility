import { Hono } from "hono";
import { paymentClaim } from "./replay";
import { HonoAdapter } from "@x402/hono";
import type {
  FacilitatorClient,
  HTTPResponseInstructions,
} from "@x402/core/server";
import { isAddress } from "viem";
import {
  CompanySchema,
  ServiceError,
  companyNumber,
  AMOUNT,
  outputSchema,
  type CompanyLookup,
} from "./schema";
import { paymentServer } from "./payment";
import { openapi, description } from "./discovery";
import { clientHash, safeAgent, safeOrigin, type Metric } from "./analytics";
export type AppConfig = {
  payTo: string;
  analyticsSecret: string;
  knownWallets: string[];
  origin: string;
  ready: boolean;
};
export type Dependencies = {
  facilitator: FacilitatorClient;
  companies: CompanyLookup;
  record: (metric: Metric) => void;
  claimPayment: (id: string, expires: number) => Promise<boolean>;
};
function instructions(r: HTTPResponseInstructions): Response {
  return new Response(JSON.stringify(r.body ?? {}), {
    status: r.status,
    headers: {
      ...r.headers,
      "content-type": "application/json",
      "cache-control": "private, no-store",
    },
  });
}
export function createApp(config: AppConfig, deps: Dependencies) {
  const app = new Hono();
  const configured =
    config.ready &&
    isAddress(config.payTo) &&
    !/^0x0{40}$/i.test(config.payTo) &&
    config.analyticsSecret.length >= 32;
  const http = configured
    ? paymentServer(config.payTo, deps.facilitator)
    : null;
  let init: Promise<void> | undefined;
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
    c.header("X-Content-Type-Options", "nosniff");
  });
  app.get("/", (c) =>
    c.json({
      name: "UK Company Intelligence",
      description,
      testnet_only: true,
      openapi: "/openapi.json",
      schema: "/schemas/company-v1.json",
    }),
  );
  app.get("/health", (c) =>
    c.json(
      {
        status: configured ? "configured" : "not_configured",
        testnet_only: true,
      },
      configured ? 200 : 503,
    ),
  );
  app.get("/openapi.json", (c) => c.json(openapi(config.origin)));
  app.get("/schemas/company-v1.json", (c) => c.json(outputSchema));
  app.get("/llms.txt", (c) =>
    c.text(
      `# UK Company Intelligence\n${description}\nAPI: ${config.origin}/openapi.json\nSchema: ${config.origin}/schemas/company-v1.json\nGET /v1/uk-company/{companyNumber}\nOnly Base Sepolia (eip155:84532). $0.01 test USDC. No affiliation with Companies House, Coinbase or Cloudflare.\n`,
    ),
  );
  app.all("/v1/uk-company/:companyNumber", async (c) => {
    const started = Date.now();
    const number = companyNumber(c.req.param("companyNumber"));
    const channel = c.req.header("X-Discovery-Channel");
    const metric: Metric = {
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID(),
      endpoint: "/v1/uk-company/:companyNumber",
      company_number: number,
      http_status: 500,
      outcome: "internal_error",
      paid: false,
      verification: "not_attempted",
      settlement: "not_attempted",
      cache: "not_checked",
      latency_ms: 0,
      upstream_ms: null,
      upstream_outcome: "not_called",
      x402_version: null,
      user_agent: safeAgent(c.req.header("user-agent") ?? null),
      referrer_origin: safeOrigin(c.req.header("referer") ?? null),
      discovery_channel: ["bazaar", "mcp", "direct", "self-test"].includes(
        channel ?? "",
      )
        ? channel!
        : "unattributed",
      client_hash: null,
      client_cohort: "unknown",
      amount_atomic: "0",
      transaction_id: null,
    };
    const finish = (r: Response, outcome: string) => {
      metric.http_status = r.status;
      metric.outcome = outcome;
      metric.latency_ms = Date.now() - started;
      try {
        deps.record(metric);
      } catch {
        /* Analytics failures never change payment outcome. */
      }
      r.headers.set("X-Request-Id", metric.request_id);
      return r;
    };
    if (c.req.method !== "GET")
      return finish(
        new Response(null, { status: 405, headers: { Allow: "GET" } }),
        "method_not_allowed",
      );
    if (
      !number ||
      c.req.path !== `/v1/uk-company/${c.req.param("companyNumber")}` ||
      new URL(c.req.url).search
    )
      return finish(
        Response.json(
          { error: "invalid_company_number_or_query" },
          { status: 400 },
        ),
        "validation_error",
      );
    if (!http)
      return finish(
        Response.json({ error: "service_not_configured" }, { status: 503 }),
        "not_configured",
      );
    const paymentHeader = c.req.header("payment-signature");
    if ((paymentHeader?.length ?? 0) > 16384 || c.req.header("x-payment"))
      return finish(
        Response.json(
          { error: "invalid_payment_header_use_v2" },
          { status: 400 },
        ),
        "invalid_header",
      );
    const context = {
      adapter: new HonoAdapter(c),
      path: c.req.path,
      method: "GET",
      paymentHeader,
    };
    try {
      // Fail closed if router and x402 route matching ever disagree.
      if (!http.requiresPayment(context))
        return finish(
          Response.json({ error: "payment_route_mismatch" }, { status: 503 }),
          "route_mismatch",
        );
      init ??= http.initialize().catch((e) => {
        init = undefined;
        throw e;
      });
      await init;
      metric.verification = paymentHeader ? "pending" : "not_attempted";
      const gate = await http.processHTTPRequest(context);
      if (gate.type === "payment-error") {
        metric.verification = paymentHeader ? "rejected" : "not_attempted";
        return finish(instructions(gate.response), "payment_required");
      }
      if (gate.type !== "payment-verified")
        return finish(
          Response.json(
            { error: "payment_gate_failed_closed" },
            { status: 503 },
          ),
          "gate_failed_closed",
        );
      metric.verification = "verified";
      metric.x402_version = gate.paymentPayload.x402Version;
      const claim = await paymentClaim(
        gate.paymentPayload,
        gate.paymentRequirements,
      );
      if (!(await deps.claimPayment(claim.id, claim.expires)))
        return finish(
          Response.json(
            { error: "payment_already_claimed_use_fresh_authorisation" },
            { status: 409 },
          ),
          "replay_rejected",
        );
      let result;
      try {
        result = await deps.companies.lookup(number);
        CompanySchema.parse(result.data);
      } catch (e) {
        await gate.cancellationDispatcher.cancel({
          reason: "handler_failed",
          responseStatus: e instanceof ServiceError ? e.status : 502,
        });
        const error =
          e instanceof ServiceError
            ? e
            : new ServiceError("company_service_failed", 502);
        metric.upstream_outcome = "failed";
        return finish(
          Response.json(
            { error: error.code },
            {
              status: error.status,
              headers: error.retryAfter
                ? { "Retry-After": String(error.retryAfter) }
                : {},
            },
          ),
          "upstream_error",
        );
      }
      metric.cache = result.cache;
      metric.upstream_ms = result.upstream_ms;
      metric.upstream_outcome = result.upstream_outcome;
      metric.settlement = "pending";
      const settled = await http.processSettlement(
        gate.paymentPayload,
        gate.paymentRequirements,
        gate.declaredExtensions,
        { request: context },
        undefined,
        gate.beforeHandlerSettlement,
      );
      if (!settled.success) {
        metric.settlement = "failed";
        return finish(instructions(settled.response), "settlement_failed");
      }
      // No response body is released before a successful settlement.
      metric.settlement = "settled";
      metric.paid = true;
      metric.amount_atomic = AMOUNT;
      metric.transaction_id = settled.transaction;
      if (settled.payer) {
        metric.client_hash = await clientHash(
          settled.payer,
          config.analyticsSecret,
        );
        metric.client_cohort = config.knownWallets.some(
          (w) => w.toLowerCase() === settled.payer!.toLowerCase(),
        )
          ? "known_test_or_invited"
          : "unknown_external_candidate";
      }
      return finish(
        Response.json(result.data, {
          headers: {
            ...settled.headers,
            "Cache-Control": "private, no-store",
            "X-Data-Cache": result.cache,
          },
        }),
        "success",
      );
    } catch {
      if (metric.verification === "pending") metric.verification = "error";
      if (metric.settlement === "pending") metric.settlement = "unknown";
      return finish(
        Response.json(
          { error: "payment_service_unavailable" },
          { status: 503 },
        ),
        "payment_service_error",
      );
    }
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((_e, c) => c.json({ error: "internal_error" }, 500));
  return app;
}
