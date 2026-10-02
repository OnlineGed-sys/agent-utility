# API contract 1.0.0

`GET /v1/uk-company/{companyNumber}`

Keep all leading zeroes. Lowercase is normalised to uppercase. Accepted syntax is exactly eight ASCII letters/digits, supporting numeric, prefixed and legacy register forms (including identifiers with trailing letters). This is a safe syntax envelope, not a claim that every combination is a registered company. Existence is decided by Companies House. No silent padding, whitespace trimming, path separators or arbitrary URLs. No query parameters.

## Responses

| Status | Meaning                                                            | Payment behaviour                                        |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 200    | Schema-valid result, possibly explicitly partial                   | Settlement succeeded; receipt in `PAYMENT-RESPONSE`      |
| 400    | Invalid identifier/query or unsupported/oversized header           | No upstream lookup                                       |
| 402    | Missing/rejected authorisation, or settlement failure              | No company JSON; initial challenge in `PAYMENT-REQUIRED` |
| 404    | Company not found; or unknown API path                             | Company lookup failure does not settle                   |
| 405    | Unsupported method                                                 | No upstream lookup; `Allow: GET`                         |
| 409    | Authorisation already claimed                                      | Must use a new authorisation                             |
| 502    | Invalid upstream result or upstream server failure                 | No settlement for profile failure                        |
| 503    | Missing secrets, provider/facilitator unavailable, quota exhausted | Fail closed; `Retry-After` where known                   |
| 504    | Companies House unreachable/timed out                              | No settlement for profile failure                        |

The standard v2 headers use base64 JSON. Settlement-failure responses may carry a receipt/error without another `PAYMENT-REQUIRED`; clients must not loop indefinitely. `X-Request-Id` supports correlation; `X-Data-Cache` is `hit` or `miss` on success. Every response is private/no-store.

A failed settlement can occur after upstream computation. The result stays inside the service and may be cached for a later separately paid call.

## Stable JSON shape

`GET /schemas/company-v1.json` is generated directly from the same Zod schema used by both seller and buyer. `GET /openapi.json` supplies OpenAPI 3.1 and pricing metadata. The Bazaar example is prominently synthetic, not purported live data.

| Field                                                | Semantics                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `schema_version`                                     | `1.0.0`                                                                                           |
| `company_number`, `company_name`                     | Required authoritative identity; mismatched upstream identity is rejected                         |
| `company_status`, `company_type`, `date_of_creation` | Direct source values; null when missing                                                           |
| `registered_office_address`, `sic_codes`             | Source address and classification; null when missing                                              |
| `accounts`, `confirmation_statement`                 | Source objects, preserved as factual records, including source overdue flags                      |
| `active_officer_count`                               | Source `active_count`; all active officer roles, not solely directors                             |
| `active_director_count`                              | Always null in this POC; we do not infer directors from officer totals or a partial page          |
| `charges`                                            | `has_charges` from profile; available aggregate counts from charges endpoint                      |
| `insolvency`                                         | Profile history/liquidation flags and available case types/dates; practitioner identities omitted |
| `derived`                                            | Explicit deterministic date calculations below                                                    |
| `sources`                                            | Fixed official URLs and per-component status: ok/not_found/unavailable/not_requested              |
| `warnings`                                           | Component failures; no raw upstream error text                                                    |
| `retrieved_at`                                       | UTC time after the fetch sequence; retained on cache hits                                         |

Missing does not mean false or zero. If the profile explicitly says there are no charges or insolvency history, the corresponding extra request is skipped; other fields remain null. No insolvency flag is treated as a current court finding, and no source statement is independently verified by this service.

## Derived rule: due-date-v1

`evaluated_on` is the Europe/London calendar date at `retrieved_at`.

- `next_accounts_due_on` takes valid `accounts.next_accounts.due_on`, falling back to the deprecated `accounts.next_due` only when the former is missing/invalid.
- `accounts_appear_overdue = next_accounts_due_on < evaluated_on`.
- `confirmation_statement_appears_overdue = confirmation_statement.next_due < evaluated_on`.
- Missing or invalid due dates produce null. Due today produces false. Source overdue booleans remain in the source objects and can differ.

These are comparisons of the dates in the retrieved record, not assertions about legal compliance or applicability to dissolved/exempt entities. Derivations are not recalculated on a cached snapshot. No company risk score is produced.

## Partial results

The profile is mandatory. Officers, charges and insolvency components may be unavailable independently. A schema-valid partial response still costs 0.01 test USDC and explicitly identifies missing components. This permits a useful response without pretending complete coverage. A future stricter product can add a completeness requirement before settlement.

Charges count normalisation accepts both `unfiltered_count` and the official schema's legacy spelling `unfiletered_count`, preferring the former when present. No count is computed from a partial list.
