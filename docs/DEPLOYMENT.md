# Exact deployment handoff

The project is built for Cloudflare Workers, three SQLite-backed Durable Object bindings and one D1 database. A dry-run bundle is tested. No Cloudflare account was authenticated in the build session; no deployment is claimed.

## Unavoidable account actions

1. **GitHub:** create an empty repository named `agent-utility` under `OnlineGed-sys` (private is the conservative default). The connected GitHub tool can edit repositories but did not expose repository creation. Grant the connection access to the new repository. The prepared project can then be pushed without recreating it.
2. **Companies House:** at https://developer.company-information.service.gov.uk/get-started, create an application and a **live REST API key** for the Public Data API. The required manual action is creating this key. Enter it only at `wrangler secret put COMPANIES_HOUSE_API_KEY` below.
3. **Cloudflare:** run `npx wrangler login` and authorise the intended account, or configure a scoped Wrangler API token in your local environment. Account authorisation cannot be inferred from the GitHub connection.
4. **Test tokens:** run the wallet helper below, then use https://faucet.circle.com/ with **Base Sepolia / USDC**, sending free test tokens to the printed buyer address. Never buy crypto or select Base mainnet. Human faucet verification may be required.

## Prepared commands

From the repository root:

```sh
npm ci
npm run wallet:init
npx wrangler login
npx wrangler d1 create agent-utility-metrics --location weur
```

The wallet helper writes `private/testnet.env` and prints only public addresses. Note the D1 UUID returned by Wrangler. Set public configuration and run the checked-in configuration helper (replace only the capitalised placeholders):

```sh
export D1_DATABASE_ID='RETURNED_D1_UUID'
export PUBLIC_ORIGIN='https://agent-utility.YOUR_WORKERS_SUBDOMAIN.workers.dev'
node --env-file=private/testnet.env --import tsx scripts/configure.ts
npx wrangler d1 migrations apply agent-utility-metrics --remote
npx wrangler secret put COMPANIES_HOUSE_API_KEY
```

Paste the Companies House key at the interactive secret prompt. Install only the generated analytics secret via stdin; the seller and buyer private keys must never be sent to Cloudflare:

```sh
node --env-file=private/testnet.env -e 'process.stdout.write(process.env.ANALYTICS_HMAC_SECRET)' | npx wrangler secret put ANALYTICS_HMAC_SECRET
npm run check
npm run bundle
npm run test:runtime
npm run deploy
```

If Wrangler asks to create the named Worker while adding its first secret, accept creation of this test project. The configured network remains Base Sepolia. If the deployment URL differs, update `PUBLIC_ORIGIN`, rerun the configuration helper and deploy again.

## Confirm the complete loop

```sh
curl -i "$PUBLIC_ORIGIN/v1/uk-company/00000006"
export BUYER_URL="$PUBLIC_ORIGIN/v1/uk-company/00000006"
node --env-file=private/testnet.env --import tsx scripts/buyer.ts
node --env-file=private/testnet.env --import tsx scripts/buyer.ts
npm run metrics
npm run discovery:check
```

Expected: unsigned 402 with `PAYMENT-REQUIRED`; buyer `[402,200]` with receipt and real schema-valid company data; a later paid call gives `cache: hit`; D1 shows both paid events under `known_test_or_invited`. A cold call can already be cached by another client; do not assume the first call is always a miss.

Inspect the reported transaction on Base Sepolia, not Base mainnet. Save the buyer report (not its environment file) as evidence. Check the official Companies House source URL against the returned identity. Stage 0 is only complete after these steps succeed against the deployed service.

## GitHub upload

The archive contains source and `agent-utility.git.bundle`. To restore the prepared Git history from the directory containing the extracted `agent-utility` folder, run `git clone agent-utility/agent-utility.git.bundle agent-utility-checkout`, then enter that checkout. Its `origin` initially points to the bundle: use `git remote set-url origin https://github.com/OnlineGed-sys/agent-utility.git` before pushing.

Once the empty repository exists, from an original checkout with no remote:

```sh
git remote add origin https://github.com/OnlineGed-sys/agent-utility.git
git push -u origin main
```

If `origin` is already configured, check that it points to the intended GitHub repository, not the local bundle. Authenticate using your normal GitHub credential helper; never put a token in a remote URL. An archive copy includes the source plus an optional Git bundle so its prepared history can be restored. The CI workflow tests and scans on push/PR; it does not auto-deploy or need payment secrets.

## Local development and rollback

Copy server values into ignored `.dev.vars`; keep buyer secrets separate. Use `npx wrangler d1 migrations apply agent-utility-metrics --local` then `npm run dev`. For rollback, use Wrangler's normal deployment history; the initial D1 migration is additive. Disabling the Worker or removing its Companies House secret stops paid operation. Do not change the network constants to conduct this experiment.
