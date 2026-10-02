// Full Worker/DO/D1 runtime integration, using explicitly simulated external services.
import {
  Miniflare,
  convertV4MiniflareOptions,
  Response as MfResponse,
} from "miniflare";
import { readFile } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { SimulatedFacilitator, profile } from "../tests/helpers";
import { buy } from "../src/buyer";
import type { Env } from "../src/worker";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
const key = generatePrivateKey(),
  buyer = privateKeyToAccount(key).address,
  payTo = privateKeyToAccount(generatePrivateKey()).address;
const facilitator = new SimulatedFacilitator();
let upstream = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: "dist/worker.js",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      COMPANY_CACHE: { className: "CompanyCache", useSQLite: true },
      UPSTREAM_QUOTA: { className: "UpstreamQuota", useSQLite: true },
      PAYMENT_CLAIMS: { className: "PaymentClaims", useSQLite: true },
    },
    d1Databases: { METRICS: "metrics" },
    bindings: {
      PUBLIC_ORIGIN: "https://worker.test",
      PAY_TO_ADDRESS: payTo,
      ANALYTICS_HMAC_SECRET: crypto.randomUUID() + crypto.randomUUID(),
      COMPANIES_HOUSE_API_KEY: "runtime-fixture-key",
      KNOWN_BUYER_ADDRESSES: buyer,
    },
    outboundService: async (req) => {
      const u = new URL(req.url);
      if (u.hostname === "api.company-information.service.gov.uk") {
        upstream++;
        return MfResponse.json(
          u.pathname.endsWith("/officers") ? { active_count: 3 } : profile,
        );
      }
      if (u.hostname === "x402.org") {
        if (u.pathname.endsWith("/supported"))
          return MfResponse.json(await facilitator.getSupported());
        const body = (await req.json()) as {
          paymentPayload: PaymentPayload;
          paymentRequirements: PaymentRequirements;
        };
        if (u.pathname.endsWith("/verify"))
          return MfResponse.json(
            await facilitator.verify(
              body.paymentPayload,
              body.paymentRequirements,
            ),
          );
        if (u.pathname.endsWith("/settle"))
          return MfResponse.json(
            await facilitator.settle(
              body.paymentPayload,
              body.paymentRequirements,
            ),
          );
      }
      throw new Error("Unexpected outbound request");
    },
  }),
);
try {
  const db = await mf.getD1Database("METRICS");
  for (const statement of (
    await readFile("migrations/0001_metrics.sql", "utf8")
  )
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const r = await mf.dispatchFetch(req.url, {
      method: req.method,
      headers: Object.fromEntries(req.headers),
    });
    return new Response(await r.arrayBuffer(), {
      status: r.status,
      headers: Object.fromEntries(r.headers),
    });
  };
  const first = await buy(
    "https://worker.test/v1/uk-company/00000006",
    key,
    payTo,
    transport,
  );
  const second = await buy(
    "https://worker.test/v1/uk-company/00000006",
    key,
    payTo,
    transport,
  );
  if (
    first.report.cache !== "miss" ||
    second.report.cache !== "hit" ||
    upstream !== 2
  )
    throw new Error("Runtime cache failed");
  const bindings = await mf.getBindings<Env>();
  const claim = bindings.PAYMENT_CLAIMS.getByName("runtime-atomic-claim");
  const claims = await Promise.all(
    Array.from({ length: 20 }, () => claim.claim(Date.now() + 600000)),
  );
  if (claims.filter(Boolean).length !== 1)
    throw new Error("Atomic replay claims failed");
  const quota = bindings.UPSTREAM_QUOTA.getByName(
    "isolated-runtime-quota-test",
  );
  const permits = await Promise.all(
    Array.from({ length: 501 }, () => quota.acquire()),
  );
  if (permits.filter(Boolean).length !== 500)
    throw new Error("Global quota failed");
  // Reading D1 after dispatchFetch also confirms metric writes survived waitUntil.
  const rows = await db
    .prepare("SELECT paid,event FROM request_events")
    .all<{ paid: number; event: string }>();
  if (rows.results.filter((r) => r.paid === 1).length !== 2)
    throw new Error("Runtime analytics failed");
  if (
    JSON.stringify(rows).includes(key) ||
    JSON.stringify(rows).includes("runtime-fixture-key")
  )
    throw new Error("Secrets reached analytics");
  console.log(
    JSON.stringify(
      {
        runtime: "workerd",
        external_services: "simulated",
        buyer_statuses: first.report.statuses,
        first_cache: first.report.cache,
        second_cache: second.report.cache,
        upstream_calls: upstream,
        atomic_claim_winners: claims.filter(Boolean).length,
        quota_permits: permits.filter(Boolean).length,
        paid_metric_rows: rows.results.filter((r) => r.paid === 1).length,
        settlement_proven_onchain: false,
      },
      null,
      2,
    ),
  );
} finally {
  await mf.dispose();
}
