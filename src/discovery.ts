import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { AMOUNT, COMPANY_PATTERN, NETWORK, outputSchema, USDC } from "./schema";
export const description =
  "Structured UK company public records from Companies House: profile, filing deadlines, officer count, charges and insolvency indicators. For supplier verification, procurement, vendor onboarding, business research and due diligence support. Testnet payment: 0.01 test USDC per call, including cached results.";
export const example = {
  schema_version: "1.0.0",
  company_number: "00000006",
  company_name: "ILLUSTRATIVE EXAMPLE - NOT LIVE DATA",
  company_status: null,
  company_type: null,
  date_of_creation: null,
  registered_office_address: null,
  sic_codes: null,
  accounts: null,
  confirmation_statement: null,
  active_officer_count: null,
  active_director_count: null,
  charges: {
    has_charges: null,
    total_count: null,
    satisfied_count: null,
    part_satisfied_count: null,
    unfiltered_count: null,
  },
  insolvency: {
    has_insolvency_history: null,
    has_been_liquidated: null,
    cases: null,
  },
  derived: {
    evaluated_on: "2026-10-01",
    next_accounts_due_on: null,
    accounts_appear_overdue: null,
    confirmation_statement_appears_overdue: null,
    rule_version: "due-date-v1",
  },
  sources: [],
  warnings: ["illustrative_example_only"],
  retrieved_at: "2026-10-01T00:00:00.000Z",
};
export const discovery = declareDiscoveryExtension({
  pathParams: { companyNumber: "00000006" },
  pathParamsSchema: {
    type: "object",
    properties: {
      companyNumber: {
        type: "string",
        pattern: COMPANY_PATTERN,
        description:
          "Eight-character Companies House identifier, including leading zeroes or register prefixes.",
      },
    },
    required: ["companyNumber"],
    additionalProperties: false,
  },
  output: { example, schema: outputSchema },
});
export function openapi(origin: string) {
  return {
    openapi: "3.1.0",
    info: { title: "UK Company Intelligence", version: "1.0.0", description },
    servers: [{ url: origin }],
    paths: {
      "/v1/uk-company/{companyNumber}": {
        get: {
          operationId: "uk_company_lookup",
          description,
          parameters: [
            {
              name: "companyNumber",
              in: "path",
              required: true,
              schema: { type: "string", pattern: COMPANY_PATTERN },
            },
          ],
          "x-x402": {
            version: 2,
            network: NETWORK,
            asset: USDC,
            amount: AMOUNT,
            testnet: true,
          },
          responses: {
            "200": {
              description:
                "Paid result. Missing values are null; partial components are explicitly marked.",
              content: { "application/json": { schema: outputSchema } },
            },
            "400": { description: "Invalid identifier" },
            "402": {
              description:
                "Payment required or failed; PAYMENT-REQUIRED contains base64 x402 v2 JSON",
            },
            "404": { description: "Company not found; no settlement" },
            "503": { description: "Unavailable; no company data released" },
          },
        },
      },
    },
  };
}
