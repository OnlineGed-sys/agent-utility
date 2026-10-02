# Security review

This is a testnet POC. Never use these test wallets for real assets. No production funds were spent or requested.

## Payment boundary

- Only exact USDC on `eip155:84532` is registered. Token, facilitator and price are constants.
- The official SDK generates/parses x402 v2 and delegates cryptographic/balance verification and onchain settlement to the fixed HTTPS test facilitator. A caller-supplied facilitator or upstream URL is never used.
- The company handler explicitly checks `requiresPayment` and accepts only `payment-verified`; a route mismatch cannot fall through for free.
- A local durable single-use nonce claim prevents duplicate delivery even if facilitator settlement is idempotent. This is tested separately from the simulated facilitator's ledger.
- No body is returned on settlement failure. A failed signature cannot reach the private cache or Companies House.
- No GET-body parameter, HEAD fallback, query flag, cookie, forwarded header, user-agent, referral or bearer token bypasses payment.
- Authorisations with more than five minutes left are rejected; emitted requirements allow 60 seconds. The exact EIP-3009 flow is intentional; Permit2, upto, batch settlement and SIWX repeat access are not enabled.

Trust remains in the facilitator's verification and settlement claims. The Worker is not an independent blockchain full node. Public test-facilitator availability is not guaranteed. Buyer and operator policy pins are both needed: protocol support alone is not permission to spend.

## Data, secrets and upstream

The Worker holds only Companies House and analytics secrets. Buyer/seller private keys stay local, ignored, mode 0600. Upstream authentication uses a fixed official origin with redirects disabled. No upstream error bodies, credentials or payment authorisations are logged. Responses are capped at one megabyte, upstream fetches at eight seconds, facilitator calls at fifteen seconds and buyer requests at sixty seconds.

The response includes public registered-office information but avoids officer names, birth dates, addresses and insolvency practitioner identities. Raw accounts and confirmation-statement subobjects remain source facts, not executable content. No code follows links from source records.

The quota limiter limits this installation to 500 requests per rolling five minutes. A 429 produces a conservative retry hint; there are no automatic upstream retry loops. If another application shares the same key, the actual provider limit can still be reached. Public request abuse can exhaust Worker/D1 quotas; configure Cloudflare edge rate limits before broadly promoting the endpoint. This POC does not claim internet-scale denial-of-service resistance.

## Analytics

D1 has no public access route. Wallets are HMAC-pseudonymised, user-agent is truncated/redacted, and only referral origins (no paths/query strings) are retained. No IP addresses, payment-signature headers, authorisation objects, API keys or private keys are stored. Transaction IDs are public but linkable; treat metrics as restricted operational data. Daily retention is 30 days. Disable default Worker observability request logging; the only explicit console event is a safe analytics-write-failed request ID.

Client-provided discovery channels are untrusted hints. Unknown wallets are candidates, not verified unknown autonomous agents. Wallet rotation, Sybils, forwarded calls, missing referrals and spoofed agents limit attribution.

## Failure modes still open

- A settlement can complete while its HTTP response is lost. Such outcomes are recorded as unknown when detectable. Do not automatically repay; inspect the chain and logs.
- Single-use claims intentionally consume an authorisation even if upstream work later fails. The client needs a new nonce; no charge is made on profile failure.
- There is no paid-response recovery/refund mechanism or accounting reconciliation job yet.
- A partial but schema-valid result is chargeable and clearly marked. A future strict completeness product would need different semantics.
- D1 analytics uses `waitUntil`; analytics failure does not reverse payment. Billing truth would require onchain reconciliation, not these metrics alone.
- Dependency audits and the included heuristic secret scanner do not constitute a formal audit. The lockfile is checked in. No real credential exists in test fixtures.

## Attacks exercised

Forged/malformed payment headers; signed payload amount/recipient/expiry tampering; replay and concurrent replay; failed settlement; unsupported methods including HEAD; encoded paths; query-based bypass attempts; unpaid access after cache population; invalid identifiers; missing configuration; unavailable facilitator; wrong mainnet/asset/amount/recipient buyer offers; upstream 404/401/429/500; invalid JSON/schema/mismatched company identity; quota exhaustion; cache expiry and malformed cached schema.
