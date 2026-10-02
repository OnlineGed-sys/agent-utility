# Live deployment continuation — 2 October 2026

The existing tested project is being published to https://github.com/OnlineGed-sys/agent-utility without changing its application code. The repository owner's initial commit is retained. Original local history (root commit a664b001970e259d7ff26843452d0b1eae6bfd79) is preserved exactly in evidence/original-history.bundle because direct Git push authentication was unavailable. Restore it with git clone evidence/original-history.bundle restored-original.

## External proof status

**NOT COMPLETE. No real public funded x402 purchase has succeeded.**

- Cloudflare device authorisation was initiated and the owner reported approval. The workspace then blocked the Wrangler process's connection to https://dash.cloudflare.com:443 by network policy. A subsequent wrangler whoami still reported unauthenticated. Repeating consent alone will not resolve that restriction.
- No public Worker URL, deployed D1 instance or deployment transaction exists from this continuation.
- No Companies House key exists in the project environment or expected ignored secret files.
- No persisted buyer wallet exists at private/testnet.env. The previous live negative probe generated transient, unfunded wallets; it did not create a reusable funded test wallet. Do not claim a wallet balance or settlement without provisioning it securely.
- No cryptocurrency was purchased, bridged or spent. No mainnet switch was made.

## Remaining actions

Use an execution environment permitted to reach Cloudflare's authentication and API endpoints, then complete Wrangler authentication there. Use the existing docs/DEPLOYMENT.md instructions and helper scripts; do not rebuild the service. Provision the Companies House REST key via Wrangler secrets. Locate the owner's intended test wallet if one exists outside this checkout; otherwise initialise the first persistent dedicated test wallet with the existing wallet helper and obtain free Base Sepolia USDC from the faucet. Never send private keys or API keys in chat or commit them.

After deployment, the acceptance gate remains: public 402; exact Base Sepolia asset/price/recipient; actual funded authorisation and facilitator settlement; real Companies House response; schema-valid 200; matching deployed D1 event; replay and unpaid-bypass checks. Then run the existing MCP bridge against that public endpoint and inspect the configured facilitator's own Bazaar catalogue. There is no transaction identifier or live discovery claim to report yet.

The earlier TEST-REPORT.md and docs/*evidence.json remain explicitly local/simulated or real negative-path evidence. Their tests were not rerun during this handoff because no application code changed. A fresh tracked-file secret scan passed before upload.
