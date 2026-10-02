import { z } from "zod";
export const NETWORK = "eip155:84532" as const;
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const AMOUNT = "10000";
export const TTL_SECONDS = 900;
// Safe broad syntax, not an existence test: supports legacy alphanumeric registers.
export const COMPANY_PATTERN = "^[A-Z0-9]{8}$";
export function companyNumber(input: string): string | null {
  const value = input.toUpperCase();
  return new RegExp(COMPANY_PATTERN).test(value) ? value : null;
}
const date = z.iso.date();
const object = z.record(z.string(), z.unknown());
export const CompanySchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    company_number: z.string().regex(new RegExp(COMPANY_PATTERN)),
    company_name: z.string(),
    company_status: z.string().nullable(),
    company_type: z.string().nullable(),
    date_of_creation: date.nullable(),
    registered_office_address: z.record(z.string(), z.string()).nullable(),
    sic_codes: z.array(z.string()).nullable(),
    accounts: object.nullable(),
    confirmation_statement: object.nullable(),
    active_officer_count: z.number().int().nonnegative().nullable(),
    active_director_count: z.null(),
    charges: z.object({
      has_charges: z.boolean().nullable(),
      total_count: z.number().int().nonnegative().nullable(),
      satisfied_count: z.number().int().nonnegative().nullable(),
      part_satisfied_count: z.number().int().nonnegative().nullable(),
      unfiltered_count: z.number().int().nonnegative().nullable(),
    }),
    insolvency: z.object({
      has_insolvency_history: z.boolean().nullable(),
      has_been_liquidated: z.boolean().nullable(),
      cases: z
        .array(
          z.object({ type: z.string().nullable(), dates: z.array(object) }),
        )
        .nullable(),
    }),
    derived: z.object({
      evaluated_on: date,
      next_accounts_due_on: date.nullable(),
      accounts_appear_overdue: z.boolean().nullable(),
      confirmation_statement_appears_overdue: z.boolean().nullable(),
      rule_version: z.literal("due-date-v1"),
    }),
    sources: z.array(
      z.object({
        provider: z.literal("Companies House"),
        url: z.url(),
        status: z.enum(["ok", "not_found", "unavailable", "not_requested"]),
      }),
    ),
    warnings: z.array(z.string()),
    retrieved_at: z.iso.datetime(),
  })
  .strict();
export type Company = z.infer<typeof CompanySchema>;
export const outputSchema = z.toJSONSchema(CompanySchema);
export class ServiceError extends Error {
  constructor(
    public code: string,
    public status: 400 | 404 | 429 | 502 | 503 | 504,
    public retryAfter?: number,
  ) {
    super(code);
  }
}
export type LookupResult = {
  data: Company;
  cache: "hit" | "miss";
  upstream_ms: number | null;
  upstream_outcome: "ok" | "partial" | "not_called";
};
export interface CompanyProvider {
  lookup(number: string): Promise<Company>;
}
export interface CompanyLookup {
  lookup(number: string): Promise<LookupResult>;
}
