import { DurableObject } from "cloudflare:workers";
import { createApp } from "./app";
import { CompaniesHouseProvider } from "./provider";
import { CompanyService } from "./service";
import {
  ServiceError,
  CompanySchema,
  companyNumber,
  type Company,
  type LookupResult,
} from "./schema";
import { facilitatorClient } from "./payment";
import { persistMetric } from "./analytics";
export interface Env {
  COMPANIES_HOUSE_API_KEY: string;
  PAY_TO_ADDRESS: string;
  ANALYTICS_HMAC_SECRET: string;
  PUBLIC_ORIGIN: string;
  KNOWN_BUYER_ADDRESSES?: string;
  COMPANY_CACHE: DurableObjectNamespace<CompanyCache>;
  UPSTREAM_QUOTA: DurableObjectNamespace<UpstreamQuota>;
  METRICS: D1Database;
  PAYMENT_CLAIMS: DurableObjectNamespace<PaymentClaims>;
}
export class PaymentClaims extends DurableObject<Env> {
  async claim(expires: number): Promise<boolean> {
    return this.ctx.storage.transaction(async (tx) => {
      if (await tx.get("used")) return false;
      await tx.put("used", true);
      await tx.setAlarm(expires);
      return true;
    });
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
export class UpstreamQuota extends DurableObject<Env> {
  async acquire(): Promise<boolean> {
    return this.ctx.storage.transaction(async (tx) => {
      const now = Date.now();
      const times = ((await tx.get<number[]>("requests")) ?? []).filter(
        (t) => t > now - 300000,
      );
      if (times.length >= 500) return false;
      times.push(now);
      await tx.put("requests", times);
      return true;
    });
  }
}
export class CompanyCache extends DurableObject<Env> {
  private service: CompanyService;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const provider = new CompaniesHouseProvider(
      env.COMPANIES_HOUSE_API_KEY,
      fetch,
      () => env.UPSTREAM_QUOTA.getByName("companies-house-global").acquire(),
    );
    this.service = new CompanyService(provider, {
      get: () =>
        ctx.storage.get<{ expires: number; data: Company }>("snapshot"),
      put: async (value) => {
        await ctx.storage.put("snapshot", value);
        await ctx.storage.setAlarm(value.expires);
      },
    });
  }
  async lookup(number: string): Promise<string> {
    if (companyNumber(number) !== number)
      return JSON.stringify({
        ok: false,
        code: "invalid_company_number",
        status: 400,
      });
    try {
      return JSON.stringify({
        ok: true,
        value: await this.service.lookup(number),
      });
    } catch (e) {
      const error =
        e instanceof ServiceError
          ? e
          : new ServiceError("upstream_failed", 502);
      return JSON.stringify({
        ok: false,
        code: error.code,
        status: error.status,
        retryAfter: error.retryAfter,
      });
    }
  }
  async alarm() {
    const snapshot = await this.ctx.storage.get<{ expires: number }>(
      "snapshot",
    );
    if (snapshot && snapshot.expires <= Date.now())
      await this.ctx.storage.delete("snapshot");
    else if (snapshot) await this.ctx.storage.setAlarm(snapshot.expires);
  }
}
// Request-specific execution context is not stored globally.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const events: Parameters<typeof persistMetric>[1][] = [];
    // App instance is per request so metrics cannot leak between concurrent requests.
    // Only facilitator support metadata is cached globally, never buyer payloads.
    const app = createApp(
      {
        payTo: env.PAY_TO_ADDRESS ?? "",
        analyticsSecret: env.ANALYTICS_HMAC_SECRET ?? "",
        knownWallets: (env.KNOWN_BUYER_ADDRESSES ?? "")
          .split(",")
          .filter(Boolean),
        origin: env.PUBLIC_ORIGIN ?? "",
        ready: Boolean(
          env.COMPANIES_HOUSE_API_KEY &&
          env.METRICS &&
          env.COMPANY_CACHE &&
          env.UPSTREAM_QUOTA &&
          env.PAYMENT_CLAIMS,
        ),
      },
      {
        facilitator: facilitatorClient(),
        companies: {
          async lookup(number) {
            const result = JSON.parse(
              await env.COMPANY_CACHE.getByName(number).lookup(number),
            ) as
              | { ok: true; value: LookupResult }
              | {
                  ok: false;
                  code: string;
                  status: 400 | 404 | 429 | 502 | 503 | 504;
                  retryAfter?: number;
                };
            if (!result.ok)
              throw new ServiceError(
                result.code,
                result.status,
                result.retryAfter,
              );
            CompanySchema.parse(result.value.data);
            return result.value;
          },
        },
        record: (event) => events.push(event),
        claimPayment: (id, expires) =>
          env.PAYMENT_CLAIMS.getByName(id).claim(expires),
      },
    );
    const response = await app.fetch(request);
    for (const event of events)
      ctx.waitUntil(
        persistMetric(env.METRICS, event).catch(() =>
          console.error(
            JSON.stringify({
              event: "analytics_write_failed",
              request_id: event.request_id,
            }),
          ),
        ),
      );
    return response;
  },
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      env.METRICS.prepare(
        "DELETE FROM request_events WHERE timestamp < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')",
      ).run(),
    );
  },
} satisfies ExportedHandler<Env>;
