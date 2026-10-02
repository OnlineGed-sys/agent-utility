# Environment and secrets

`.env.example` contains names only. `.env*`, `.dev.vars*`, `private/`, keys and local Worker state are ignored by Git. Do not paste secrets into issues, chat, command arguments, logs or documentation.

| Name                                            | Scope                           | Secret?            | Purpose                                                                       |
| ----------------------------------------------- | ------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `COMPANIES_HOUSE_API_KEY`                       | Worker + company Durable Object | Yes                | Live Public Data API REST key; Basic auth username with empty password        |
| `ANALYTICS_HMAC_SECRET`                         | Worker                          | Yes                | At least 32 characters of random key material; stable wallet pseudonyms       |
| `PAY_TO_ADDRESS`                                | Worker                          | No                 | Nonzero recipient EVM public address; testnet only                            |
| `PUBLIC_ORIGIN`                                 | Worker/tools                    | No                 | Canonical public HTTPS origin for metadata                                    |
| `KNOWN_BUYER_ADDRESSES`                         | Worker                          | Public identifiers | Comma-separated owner/test/invited wallets to exclude from organic candidates |
| `BUYER_PRIVATE_KEY`                             | Buyer/MCP process only          | Yes                | Dedicated faucet-funded Base Sepolia wallet; never deployed                   |
| `BUYER_EXPECTED_PAY_TO`                         | Buyer/MCP                       | No                 | Recipient pin checked before signing                                          |
| `BUYER_URL`                                     | Buyer/MCP                       | No                 | Exact paid HTTPS URL; localhost HTTP allowed for development                  |
| `D1_DATABASE_ID`                                | `npm run configure` only        | No                 | Existing D1 UUID written into deployment config                               |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Wrangler only                   | Token is secret    | Optional alternative to interactive `wrangler login`                          |

Cloudflare bindings: `COMPANY_CACHE`, `PAYMENT_CLAIMS`, `UPSTREAM_QUOTA`, `METRICS`.

No network/asset/price environment variable exists. Editing configuration cannot silently enable mainnet. No CDP credential is needed for the configured x402.org test facilitator. CDP Bazaar uses a separate authenticated facilitator and catalog; that integration is intentionally not enabled.

`npm run wallet:init` writes two mode-0600 local files in a mode-0700 directory. It refuses to replace existing wallets. The seller key is a backup only; Worker operation needs only its address. The buyer key is needed only by the CLI/MCP bridge. Never move real assets to either generated wallet.
