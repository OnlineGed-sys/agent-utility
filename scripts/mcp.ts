import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpBridge } from "../src/mcp";
const { BUYER_URL, BUYER_PRIVATE_KEY, BUYER_EXPECTED_PAY_TO } = process.env;
if (
  !BUYER_URL ||
  !/^0x[0-9a-fA-F]{64}$/.test(BUYER_PRIVATE_KEY ?? "") ||
  !BUYER_EXPECTED_PAY_TO
)
  throw new Error("Configure testnet buyer environment first");
const server = createMcpBridge({
  origin: new URL(BUYER_URL).origin,
  key: BUYER_PRIVATE_KEY as `0x${string}`,
  payTo: BUYER_EXPECTED_PAY_TO,
});
await server.connect(new StdioServerTransport());
