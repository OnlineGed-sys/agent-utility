import { it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpBridge } from "../src/mcp";
import { harness } from "./helpers";
import { CompanySchema } from "../src/schema";
it("MCP discovery and tool call buy the same HTTP endpoint without duplicate business logic", async () => {
  const h = harness();
  const server = createMcpBridge(
    { origin: "https://utility.test", key: h.key, payTo: h.payTo },
    h.transport,
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "independent-mcp-test", version: "1.0.0" });
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    const tools = await client.listTools();
    expect(tools.tools[0].name).toBe("uk_company_lookup");
    expect(tools.tools[0].description).toContain("0.01");
    const result = await client.callTool({
      name: "uk_company_lookup",
      arguments: { company_number: "00000006" },
    });
    expect(result.isError).not.toBe(true);
    expect(CompanySchema.parse(result.structuredContent).company_number).toBe(
      "00000006",
    );
    expect(h.facilitator.settlements).toBe(1);
    expect(h.metrics.at(-1)?.discovery_channel).toBe("mcp");
  } finally {
    await client.close();
    await server.close();
  }
});
