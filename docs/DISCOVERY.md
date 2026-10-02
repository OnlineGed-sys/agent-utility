# Discovery, checked 2 October 2026 UK time

## Implemented

The 402 advertises Bazaar through the official SDK extension. It contains the GET method, concrete path parameter, normalised route template, parameter schema, response schema and explicitly synthetic example. The resource also declares a service name, description, four topical tags, content type and exact testnet price.

Public machine-readable documents:

- `/openapi.json`: OpenAPI 3.1 and `x-x402` price/network metadata.
- `/schemas/company-v1.json`: the buyer/seller validation contract.
- `/llms.txt`: a short entrypoint to those documents. This is a convenience, not an x402 registration standard.

`npm run discovery:check` queries the configured facilitator's Bazaar catalogue for the deployed origin. It scans at most 1,000 entries and says so when no match is found. A failed listing check is not proof that a service is absent from every page or facilitator.

## What indexing actually requires

Bazaar is the best-supported directly relevant mechanism found in current official x402 documentation. Facilitators can provide `/discovery/resources`; listing depends on their own implementation and successful metadata processing. A public endpoint, a settled payment and an observed listing are separate evidence items.

**x402.org has its own catalogue. It is not the Coinbase CDP Bazaar.** Current CDP documentation describes testnet discovery after verify/settle through CDP, with API authentication. This POC uses the no-key x402.org test facilitator to minimise onboarding. It does not claim a CDP listing. CDP offers a public metadata validation endpoint; it needs a reachable deployed service. Native Bazaar indexing and broader agent distribution must be checked after deployment, not inferred from our local schema tests.

The service publishes the documented metadata and forwards SDK settlement headers. It does not manufacture a catalogue entry or a discovery-success claim. The observed public 402 carries the metadata; no public funded settlement or indexed listing has yet been proven.

## MCP

The official x402 SDK now documents native MCP payment support and Bazaar tool metadata. For this POC the smaller, tested implementation is a **local stdio bridge** named `agent-utility-testnet-bridge`. It exposes `uk_company_lookup`, pays the same HTTP endpoint with its configured test wallet and returns the same schema. Each invocation has a payment side effect (`readOnlyHint: false`, `idempotentHint: false`). It supports ordinary MCP clients without creating a second settlement path.

Run `node --env-file=private/testnet.env --import tsx scripts/mcp.ts` with `BUYER_URL` configured. Add that command to your MCP client's configuration. Only the local process gets the buyer key; tool arguments contain the company number alone. The MCP bridge is not published to a registry, has no public MCP transport URL, and is not advertised as a native x402 MCP seller. A native MCP seller/registry publication can follow demonstrated HTTP demand; registry metadata alone would not solve payment discovery.

## Interpretation

An agent finding this metadata still needs a funded compatible wallet, a spending policy, a reason to buy this data and a tool-discovery path. The presence or volume of internet bots does not establish any of those conditions. The economic value offered is a small, normalised, credential-free-to-the-buyer capability—not exclusive access to Companies House records.

Sources: https://docs.x402.org/extensions/bazaar ; https://docs.cdp.coinbase.com/x402/seller/get-discovered ; https://docs.x402.org/guides/mcp-server-with-x402 ; https://registry.modelcontextprotocol.io/docs
