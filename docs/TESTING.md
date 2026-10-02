# Testing and evidence levels

```sh
npm ci
npm run check
npm run bundle
npm run test:runtime
npm run secrets:check
npm audit --audit-level=high
```

`check` runs ESLint, TypeScript and Vitest. The unit/integration suite uses official x402 seller and buyer code, randomly generated in-memory test wallets, real EIP-712 signatures and a deterministic simulated facilitator ledger. Companies House fixtures are explicitly synthetic. No keys are fixed in source and no test needs real money.

`test:runtime` runs the bundled Worker in Cloudflare workerd through Miniflare, including real Durable Object transactions and D1. External facilitator and Companies House calls are intercepted by test doubles. It checks the end-to-end buyer, cache, atomic claims, global quota and stored paid metrics. This catches differences that Node-only tests cannot.

`probe:live` contacts https://x402.org/facilitator with no API key. It obtains a real supported-capabilities response, constructs the actual challenge with the official SDK and tries a freshly generated unfunded buyer. Expected rejection: `invalid_exact_evm_insufficient_balance`, with zero provider calls. The probe does not establish company retrieval or settlement.

`buyer` is the funded acceptance test. It makes exactly one initial request and at most one paid retry, refuses redirects, checks network/token/price/recipient/resource before signing, validates the final schema and requires a successful settlement receipt. Only a real funded deployment run proves Stage 0. Do not replace its result with fixture evidence.

The secret scanner covers tracked filenames and common credential patterns. Review `git diff --cached`, ignored files and the lockfile before a push. CI runs checks, Worker build, runtime integration, secret scan and high-severity dependency audit; no secrets or chain funds belong in CI.

## Release acceptance

Record the deployed URL, commit ID, actual 402, successful buyer report, testnet transaction confirmation, source-data identity, cache result, analytics rows and observed discovery listing status. Keep all claims qualified until the corresponding artefact exists.
