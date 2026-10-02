import {
  CompanySchema,
  ServiceError,
  type Company,
  type CompanyProvider,
} from "./schema";
import { z } from "zod";
const API = "https://api.company-information.service.gov.uk";
const record = z.record(z.string(), z.unknown());
const optionalRecord = record.optional();
const Profile = z.object({
  company_number: z.string(),
  company_name: z.string(),
  company_status: z.string().optional(),
  type: z.string().optional(),
  date_of_creation: z.iso.date().optional(),
  registered_office_address: z.record(z.string(), z.string()).optional(),
  sic_codes: z.array(z.string()).optional(),
  accounts: optionalRecord,
  confirmation_statement: optionalRecord,
  has_charges: z.boolean().optional(),
  has_insolvency_history: z.boolean().optional(),
  has_been_liquidated: z.boolean().optional(),
});
const count = z.number().int().nonnegative().optional();
const Officers = z.object({ active_count: count });
const Charges = z.object({
  total_count: count,
  satisfied_count: count,
  part_satisfied_count: count,
  unfiltered_count: count,
  unfiletered_count: count,
});
const Insolvency = z.object({
  cases: z.array(
    z.object({
      type: z.string().optional(),
      dates: z.array(record).optional(),
    }),
  ),
});
const asDate = (value: unknown): string | null => {
  const r = z.iso.date().safeParse(value);
  return r.success ? r.data : null;
};
export function overdue(due: string | null, today: string): boolean | null {
  return due === null ? null : due < today;
}
export function derive(
  accounts: Record<string, unknown> | null,
  confirmation: Record<string, unknown> | null,
  at: string,
): Company["derived"] {
  const next = record.safeParse(accounts?.next_accounts);
  const due =
    asDate(next.success ? next.data.due_on : null) ??
    asDate(accounts?.next_due);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
  return {
    evaluated_on: today,
    next_accounts_due_on: due,
    accounts_appear_overdue: overdue(due, today),
    confirmation_statement_appears_overdue: overdue(
      asDate(confirmation?.next_due),
      today,
    ),
    rule_version: "due-date-v1",
  };
}
export class CompaniesHouseProvider implements CompanyProvider {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
    private acquire: () => Promise<boolean> = async () => true,
    private clock: () => Date = () => new Date(),
  ) {}
  private async get(path: string): Promise<unknown> {
    if (!this.key)
      throw new ServiceError("companies_house_not_configured", 503);
    if (!(await this.acquire()))
      throw new ServiceError("upstream_budget_exhausted", 503, 60);
    let r: Response;
    try {
      r = await this.request.call(globalThis, API + path, {
        headers: {
          Authorization: `Basic ${btoa(this.key + ":")}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
        redirect: "manual",
      });
    } catch {
      throw new ServiceError("upstream_unreachable_or_timeout", 504);
    }
    if (r.status === 404) throw new ServiceError("company_not_found", 404);
    if (r.status === 429)
      throw new ServiceError("upstream_rate_limited", 503, 300);
    if (r.status === 401 || r.status === 403)
      throw new ServiceError("upstream_credentials_rejected", 503);
    if (!r.ok) throw new ServiceError("upstream_failed", 502);
    // Bounded response reading; never include upstream error text or credentials in errors.
    const reader = r.body?.getReader();
    if (!reader) throw new ServiceError("upstream_empty", 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) {
        await reader.cancel();
        throw new ServiceError("upstream_too_large", 502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.length;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ServiceError("upstream_invalid_json", 502);
    }
  }
  async lookup(number: string): Promise<Company> {
    const path = `/company/${number}`;
    const p = Profile.safeParse(await this.get(path));
    if (!p.success || p.data.company_number.toUpperCase() !== number)
      throw new ServiceError("upstream_invalid_profile", 502);
    const profile = p.data;
    const sources: Company["sources"] = [
      { provider: "Companies House", url: API + path, status: "ok" },
    ];
    const warnings: string[] = [];
    const optional = async <T>(
      suffix: string,
      schema: z.ZodType<T>,
      requested = true,
    ): Promise<T | null> => {
      const source: Company["sources"][number] = {
        provider: "Companies House",
        url: API + path + suffix,
        status: "not_requested",
      };
      sources.push(source);
      if (!requested) return null;
      try {
        const result = schema.safeParse(await this.get(path + suffix));
        if (!result.success)
          throw new ServiceError("upstream_invalid_component", 502);
        source.status = "ok";
        return result.data;
      } catch (e) {
        source.status =
          e instanceof ServiceError && e.status === 404
            ? "not_found"
            : "unavailable";
        warnings.push(`${suffix.split("?")[0].slice(1)}_${source.status}`);
        return null;
      }
    };
    // Aggregate counts only: avoid fetching officer names, DOBs and personal addresses.
    const officers = await optional("/officers?items_per_page=1", Officers);
    const charges = await optional(
      "/charges",
      Charges,
      profile.has_charges !== false,
    );
    const insolvency = await optional(
      "/insolvency",
      Insolvency,
      profile.has_insolvency_history !== false,
    );
    const at = this.clock().toISOString();
    return CompanySchema.parse({
      schema_version: "1.0.0",
      company_number: number,
      company_name: profile.company_name,
      company_status: profile.company_status ?? null,
      company_type: profile.type ?? null,
      date_of_creation: profile.date_of_creation ?? null,
      registered_office_address: profile.registered_office_address ?? null,
      sic_codes: profile.sic_codes ?? null,
      accounts: profile.accounts ?? null,
      confirmation_statement: profile.confirmation_statement ?? null,
      active_officer_count: officers?.active_count ?? null,
      active_director_count: null,
      charges: {
        has_charges: profile.has_charges ?? null,
        total_count: charges?.total_count ?? null,
        satisfied_count: charges?.satisfied_count ?? null,
        part_satisfied_count: charges?.part_satisfied_count ?? null,
        unfiltered_count:
          charges?.unfiltered_count ?? charges?.unfiletered_count ?? null,
      },
      insolvency: {
        has_insolvency_history: profile.has_insolvency_history ?? null,
        has_been_liquidated: profile.has_been_liquidated ?? null,
        cases:
          insolvency?.cases.map((c) => ({
            type: c.type ?? null,
            dates: c.dates ?? [],
          })) ?? null,
      },
      derived: derive(
        profile.accounts ?? null,
        profile.confirmation_statement ?? null,
        at,
      ),
      sources,
      warnings,
      retrieved_at: at,
    });
  }
}
