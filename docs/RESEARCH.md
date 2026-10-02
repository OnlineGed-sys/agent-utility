# Implementation research record

Checked during 1 October 2026 UTC / 2 October UK-time session. Official documentation and published package declarations were used. Exact dependencies and transitive versions are in `package-lock.json`; `npm ci` is the reproducible installation path.

| Official source                                                                                                              | Implementation decision                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| https://docs.x402.org/getting-started/quickstart-for-sellers                                                                 | Official v2 resource/HTTP server and EVM exact scheme; Base Sepolia development facilitator                          |
| https://docs.x402.org/getting-started/quickstart-for-buyers                                                                  | Official payment-aware fetch wrapper with a strict before-signing policy                                             |
| https://docs.x402.org/extensions/bazaar                                                                                      | Input/output discovery declaration, dynamic path template, schemas, service name/tags                                |
| https://docs.x402.org/guides/mcp-server-with-x402                                                                            | Native MCP payment support exists; smaller HTTP-backed bridge chosen for this POC                                    |
| https://docs.cdp.coinbase.com/x402/seller/get-discovered                                                                     | Separate CDP catalogue; metadata validation and a paid CDP flow precede indexing; no automatic cross-catalogue claim |
| https://docs.cdp.coinbase.com/x402/seller/facilitator                                                                        | Facilitator verifies and settles; application still owns release of service result                                   |
| https://developers.cloudflare.com/agents/tools/payments/x402/                                                                | Cloudflare supports x402; Worker-compatible direct SDK is appropriate for this small HTTP service                    |
| https://developers.cloudflare.com/durable-objects/                                                                           | SQLite Durable Objects provide private coordination and cache/replay state                                           |
| https://developers.cloudflare.com/workers/wrangler/commands/                                                                 | Wrangler deployment/auth/database/secret operations; installed CLI help verified exact flags                         |
| https://developer.company-information.service.gov.uk/authentication                                                          | API key via HTTP Basic authentication                                                                                |
| https://developer-specs.company-information.service.gov.uk/guides/rateLimiting                                               | Published 600 requests / five minutes; use a lower shared installation budget                                        |
| https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/resources/companyprofile?v=latest | Direct profile fields and current accounts due field; deprecated fallback documented                                 |
| https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/resources/officerlist?v=latest    | Active officer total is distinct from director count; do not count one page as all directors                         |
| https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/charges/list            | Charges aggregate information                                                                                        |
| https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/insolvency/get          | Insolvency case information                                                                                          |
| https://faucet.circle.com/                                                                                                   | Free test USDC funding route; no purchase of cryptocurrency                                                          |

## Conflicts and practical findings

The installed `@x402/extensions` 2.28.0 declaration takes no `method` property in `declareDiscoveryExtension`; the HTTP server enriches it from the route. Some current web examples still pass `method`. We followed the installed official package's typed API and tested the emitted challenge.

The discovery helper omitted output metadata when only `output.schema` was supplied. An explicitly synthetic schema-valid example was added; tests assert the emitted 402 actually contains the output schema.

The installed Wrangler 4.146.0 depends on Miniflare `5.20261001.0-alpha`. Runtime tests use that exact version and its exported v4-option conversion helper. The lockfile is pinned; a successful local test does not make an alpha runtime dependency a production stability promise.

The real test facilitator rejected our fresh zero-balance buyer specifically with `invalid_exact_evm_insufficient_balance`; it did not accidentally release provider data. The saved live probe is negative-path evidence, not a funded settlement receipt.

## Commercial finding

Payment interoperability is technically tractable. Organic discovery and useful differentiated data are the harder unknowns. Testnet allows a safe technical experiment, but cannot validate actual cash willingness to pay. Companies House records are available directly; this service must earn its convenience fee through reliable aggregation and easy agent integration.

Cloudflare workerd rejects `redirect: error` for server-side fetch. The provider now uses `manual` and treats every redirect as an upstream failure; no credentials are forwarded. The full runtime regression test passes after this correction.
