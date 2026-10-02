import {
  wrapFetchWithPayment,
  x402Client,
  decodePaymentResponseHeader,
} from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { CompanySchema, NETWORK, USDC, AMOUNT } from "./schema";
export async function buy(
  url: string,
  key: `0x${string}`,
  expectedPayTo: string,
  transport: typeof fetch = fetch,
  channel: "self-test" | "mcp" = "self-test",
) {
  const target = new URL(url);
  if (
    target.protocol !== "https:" &&
    !(
      target.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(target.hostname)
    )
  )
    throw new Error("HTTPS required except localhost");
  const statuses: number[] = [];
  const limited: typeof fetch = async (input, init) => {
    const u = new URL(input instanceof Request ? input.url : String(input));
    if (u.href !== target.href) throw new Error("Buyer target changed");
    if (statuses.length >= 2) throw new Error("Buyer retry budget exceeded");
    const response = await transport(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    statuses.push(response.status);
    return response;
  };
  const client = new x402Client().register(
    NETWORK,
    new ExactEvmScheme(privateKeyToAccount(key)),
  );
  client.onBeforePaymentCreation(
    async ({ paymentRequired, selectedRequirements: r }) => {
      if (
        paymentRequired.x402Version !== 2 ||
        r.network !== NETWORK ||
        r.scheme !== "exact" ||
        r.asset.toLowerCase() !== USDC.toLowerCase() ||
        r.amount !== AMOUNT ||
        r.payTo.toLowerCase() !== expectedPayTo.toLowerCase() ||
        paymentRequired.resource.url !== url
      )
        throw new Error(
          "Payment policy rejected: testnet, exact price, asset, seller and resource must match",
        );
    },
  );
  let offered: unknown;
  const observed: typeof fetch = async (input, init) => {
    const r = await limited(input, init);
    if (r.status === 402 && statuses.length === 1) {
      const h = r.headers.get("payment-required");
      if (!h) throw new Error("Missing PAYMENT-REQUIRED");
      offered = decodePaymentRequiredHeader(h);
    }
    return r;
  };
  const response = await wrapFetchWithPayment(observed, client)(url, {
    headers: {
      Accept: "application/json",
      "X-Discovery-Channel": channel,
      "User-Agent": "agent-utility-test-buyer/0.1",
    },
  });
  if (statuses.join(",") !== "402,200")
    throw new Error(`Expected 402 -> 200, got ${statuses.join(" -> ")}`);
  const data = CompanySchema.parse(await response.json());
  const receipt = decodePaymentResponseHeader(
    response.headers.get("payment-response") ?? "",
  );
  if (!receipt.success || receipt.network !== NETWORK || !receipt.transaction)
    throw new Error("Missing successful testnet settlement receipt");
  return {
    report: {
      mode: "testnet-only",
      statuses,
      company_number: data.company_number,
      company_name: data.company_name,
      schema_valid: true,
      transaction: receipt.transaction,
      network: receipt.network,
      cache: response.headers.get("x-data-cache"),
    },
    data,
    offered,
  };
}
