import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { companyNumber } from "./schema";
import { buy } from "./buyer";
export function createMcpBridge(
  config: { origin: string; key: `0x${string}`; payTo: string },
  transport: typeof fetch = fetch,
) {
  const server = new McpServer({
    name: "agent-utility-testnet-bridge",
    version: "0.1.0",
  });
  server.registerTool(
    "uk_company_lookup",
    {
      title: "UK Company Intelligence",
      description:
        "Requires payment: 0.01 test USDC on Base Sepolia per call using this bridge’s configured test wallet. Retrieves Companies House public company profile, accounts and confirmation deadlines, active officer count, charges/insolvency indicators, provenance and retrieval timestamp. Missing fields are null. Calls the paid HTTP service; no affiliation with Companies House.",
      inputSchema: {
        company_number: z
          .string()
          .length(8)
          .describe(
            "Companies House identifier, including leading zeroes or register prefix",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ company_number }) => {
      const number = companyNumber(company_number);
      if (!number)
        return {
          isError: true,
          content: [{ type: "text" as const, text: "Invalid company number" }],
        };
      try {
        const result = await buy(
          new URL(`/v1/uk-company/${number}`, config.origin).href,
          config.key,
          config.payTo,
          transport,
          "mcp",
        );
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result.data) },
          ],
          structuredContent: result.data,
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "Paid lookup failed. Inspect seller metrics using the request ID if available; a fresh authorisation may be needed. No company result was returned.",
            },
          ],
        };
      }
    },
  );
  return server;
}
