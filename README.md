# agent-utility

**Current deployment status:** repository published; public testnet proof remains blocked. See [deployment continuation](docs/DEPLOYMENT-STATUS.md). The evidence below describes the original tested build.

This project tests whether autonomous software agents will independently discover and purchase small machine-readable capabilities using HTTP-native payments.

The first capability is **UK Company Intelligence**: `GET /v1/uk-company/:companyNumber`, priced at **0.01 test USDC**, using **x402 v2 on Base Sepolia only**. The buyer needs no account with this service. Companies House remains the authoritative source of the underlying public company information.

**This is a testnet experiment, not a production payment service.** No affiliation with Companies House, Cloudflare, Coinbase, or the UK Government is implied.

## What is implemented

- Cloudflare Worker, TypeScript and Hono; official `@x402/*` packages pinned at 2.28.0.
- Official Companies House provider with Basic API-key authentication, bounded responses, timeout, global request budget and explicit partial-data handling.
- Stable versioned JSON, source facts separated from deterministic date-derived flags.
- Payment verification before data work; settlement before response release.
- Durable, atomic single-use authorisation claims, including concurrent replay protection.
- Private 15-minute company snapshot cache; cached results still require a new payment.
- Non-sensitive D1 request metrics, wallet HMAC pseudonyms, known/unknown payer cohorts and SQL reports.
- Bazaar extension with path schema, output schema/example, service name and tags; OpenAPI, JSON Schema and `llms.txt`.
- An official-SDK buyer that signs and retries automatically with a strict testnet/asset/amount/seller policy.
- MCP `uk_company_lookup` stdio bridge that buys the same HTTP service. The bridge holds its own test buyer key locally; it is not a second public native x402 MCP seller.
- CI, security notes, deployment configuration and executable test/deployment helpers.

## Evidence and limits

See [TEST-REPORT.md](TEST-REPORT.md) and [docs/live-probe.json](docs/live-probe.json).

Automated tests exercise real x402 encoding, signing, EIP-712 signature validation and schema validation. Their settlement ledger and Companies House responses are **simulated**. The real public facilitator was separately contacted: it produced the expected v2 challenge and rejected an unfunded buyer with `invalid_exact_evm_insufficient_balance`. This does **not** prove a funded onchain purchase or live Companies House retrieval.

A real deployment, Companies House API key and faucet-funded test buyer are still required to close Stage 0. No live URL or GitHub repository is claimed by this source archive.

## Run locally

Requires Node 24 and npm. No credentials are needed for offline tests.

```sh
npm ci
npm run check
npm run bundle
npm run test:runtime
npm run probe:live
```

The last command requires network access to the public test facilitator but does not need money or real company credentials. It generates transient empty wallets and never prints their keys.

For a live local service, populate `.dev.vars` with the server entries from `.env.example`, apply the local D1 migration with `npx wrangler d1 migrations apply agent-utility-metrics --local`, and run `npm run dev`. Without secrets, the paid route returns 503 and never offers a payable service it cannot fulfil.

## Finish the funded experiment

Follow [deployment](docs/DEPLOYMENT.md). `npm run wallet:init` prepares local test wallets without printing private keys. Fund only the buyer with **free Base Sepolia test USDC**. Then use:

```sh
node --env-file=private/testnet.env --import tsx scripts/buyer.ts
```

Set `BUYER_URL` separately to the deployed company endpoint. Success must show `[402,200]`, `schema_valid: true`, a Base Sepolia transaction identifier and a Companies House-backed company result. A second purchase should show `cache: hit` and a fresh settlement.

## Project map

| Location                             | Purpose                                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| `src/app.ts`                         | Explicit fail-closed payment orchestration and HTTP routes     |
| `src/payment.ts`, `src/replay.ts`    | Official SDK integration and single-use authorisation identity |
| `src/provider.ts`, `src/service.ts`  | Authoritative provider, normalisation and snapshot cache       |
| `src/worker.ts`                      | Cloudflare entrypoint, private Durable Objects, D1 persistence |
| `src/schema.ts`, `src/discovery.ts`  | Response contract and machine discovery                        |
| `src/buyer.ts`, `src/mcp.ts`         | Payment-aware buyer and MCP bridge                             |
| `tests/`, `scripts/runtime-smoke.ts` | Unit, buyer/seller, MCP and workerd integration tests          |
| `migrations/`, `scripts/metrics.sql` | Analytics database and reports                                 |

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Environment](docs/ENVIRONMENT.md) · [Deployment](docs/DEPLOYMENT.md) · [Security](docs/SECURITY.md) · [Testing](docs/TESTING.md) · [Discovery](docs/DISCOVERY.md) · [Research](docs/RESEARCH.md) · [Experiment](EXPERIMENT.md) · [Roadmap](ROADMAP.md)

MIT covers this project's code. Underlying public records remain subject to their source's terms; see the Companies House attribution and links in each response. No subjective company risk score is generated.
