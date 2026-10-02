# Test and delivery report

Build session: 1 October 2026 UTC / 2 October 2026 Europe/London.

## Proven locally

- **37 Vitest tests passed** across provider/cache, official-SDK buyer/seller and MCP integration.
- ESLint and strict TypeScript checking passed.
- Final npm audit reported zero known vulnerabilities. The tracked-file secret-pattern scan passed.
- Cloudflare Wrangler dry-run Worker bundle succeeded (approximately 203 KiB gzip).
- Full workerd integration passed with real Durable Objects and D1, while external services were simulated:
  - buyer received 402, signed EIP-712 and retried to obtain 200;
  - first snapshot miss and second paid hit, only two source HTTP calls;
  - one winner among 20 concurrent durable payment claims;
  - 500 permits among 501 concurrent quota requests;
  - two paid D1 analytics rows, with no fixture API key or wallet key recorded.
- Public output schema and synthetic example agree; MCP tool discovery and invocation call the same paid HTTP service.
- Attacks covered malformed/forged/tampered signatures, replay and concurrent replay, an idempotent-facilitator replay scenario, alternate methods/paths/query flags, cached-result bypass, rejected settlement, wrong buyer network/price/asset/seller and missing configuration.
- Failure cases covered upstream credentials/statuses, invalid/mismatched company data, malformed JSON, timeout/unreachable upstream, quota, cache expiry and redirects.

Runtime evidence: [docs/runtime-evidence.json](docs/runtime-evidence.json). These are simulated external payments and source records, not onchain or live Companies House proof.

## Proven against a real external service

The official public test facilitator at https://x402.org/facilitator responded. Using its advertised support and the installed SDK, the seller produced x402 v2 `PAYMENT-REQUIRED`, exact Base Sepolia test USDC amount 10,000 atomic units (0.01), and Bazaar metadata. The header measured 9,328 bytes.

A fresh unfunded buyer was rejected with `invalid_exact_evm_insufficient_balance`. No Companies House call was performed. See [docs/live-probe.json](docs/live-probe.json). This is a genuine negative-path integration check. It does not prove successful settlement.

## Bugs found and fixed

1. Bazaar output schema disappeared when declared without an example. Added an explicitly synthetic, schema-valid example and an assertion on the emitted 402.
2. Cloudflare workerd does not accept fetch `redirect: error`. Replaced it with `manual`; 3xx fails safely without forwarding API credentials.
3. Relying only on facilitator nonce behaviour would leave replay handling dependent on facilitator idempotency. Added an atomic durable authorisation claim before source work, with direct runtime concurrency coverage.
4. Buyer must distinguish initial 402 challenge from a settlement-error 402 without a fresh offer. Fixed challenge parsing to occur only on the first attempt; retry remains bounded.

## Account and delivery state

- GitHub connection verified: `OnlineGed-sys`.
- `OnlineGed-sys/agent-utility` was not accessible/existing via the connection (404); the exposed connector has no repository-create operation. No GitHub repository creation or upload is claimed.
- Cloudflare `wrangler whoami`: not authenticated. No live service URL exists from this build.
- No Companies House credential was available; live authoritative retrieval is not yet verified.
- No funded test wallet was available; no real testnet settlement transaction was made.
- No real cryptocurrency was spent. No mainnet payment route exists.
- Source is committed locally and packaged with a Git bundle for continuation. A heuristic tracked-file secret scan and dependency audit are included in the final checks; neither is a formal security audit.

## Completion judgement

The seller, buyer, normalisation, storage, discovery metadata, instrumentation and MCP bridge work together in the test environment. **The ideal definition of done is not yet met:** funded live Stage 0, GitHub creation and public deployment remain blocked by account/credential/faucet steps. The exact handoff is [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Commercial judgement: technically more credible, but organic demand remains untested. The number of bots on the internet is not a customer-acquisition strategy. The useful test is whether independent agents discover this particular convenience, can pay under their policy, and choose to use it again.
