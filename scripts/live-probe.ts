// No funds needed: verifies the public test facilitator capability and real 402 challenge.
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { createApp } from "../src/app";
import { facilitatorClient, FACILITATOR } from "../src/payment";
import { buy } from "../src/buyer";
import { NETWORK, USDC, AMOUNT } from "../src/schema";
const recipient = privateKeyToAccount(generatePrivateKey()).address;
let providerCalls = 0;
let verificationReason: string | undefined;
const live = facilitatorClient();
const observed = {
  getSupported: () => live.getSupported(),
  settle: live.settle,
  verify: async (...args: Parameters<typeof live.verify>) => {
    const result = await live.verify(...args);
    verificationReason = result.invalidReason;
    return result;
  },
};
const app = createApp(
  {
    payTo: recipient,
    analyticsSecret: "probe-only-random-wallet-no-secret-logged",
    knownWallets: [],
    origin: "https://probe.example",
    ready: true,
  },
  {
    facilitator: observed,
    companies: {
      async lookup() {
        providerCalls++;
        throw new Error("No provider configured in probe");
      },
    },
    record: () => {},
    claimPayment: async () => {
      throw new Error("Unfunded buyer must never reach claim");
    },
  },
);
const transport: typeof fetch = async (input, init) =>
  app.fetch(new Request(input, init));
const url = "https://probe.example/v1/uk-company/00000006";
const response = await transport(url);
if (response.status !== 402)
  throw new Error(`Real facilitator challenge failed: ${response.status}`);
const offer = decodePaymentRequiredHeader(
  response.headers.get("payment-required")!,
);
if (
  offer.x402Version !== 2 ||
  offer.accepts[0].network !== NETWORK ||
  offer.accepts[0].asset.toLowerCase() !== USDC.toLowerCase() ||
  offer.accepts[0].amount !== AMOUNT
)
  throw new Error("Unexpected offer");
let unfundedRejected = false;
try {
  await buy(url, generatePrivateKey(), recipient, transport);
} catch {
  unfundedRejected = true;
}
if (!unfundedRejected || providerCalls)
  throw new Error("Unfunded payment did not fail closed");
console.log(
  JSON.stringify(
    {
      checked_at: new Date().toISOString(),
      facilitator: FACILITATOR,
      challenge_status: response.status,
      x402_version: offer.x402Version,
      network: NETWORK,
      amount_atomic: AMOUNT,
      payment_required_header_bytes:
        response.headers.get("payment-required")!.length,
      bazaar_declared: Boolean(offer.extensions?.bazaar),
      unfunded_buyer_rejected: unfundedRejected,
      upstream_calls: providerCalls,
      verification_reason: verificationReason,
      settlement_proven: false,
      companies_house_live_data_proven: false,
    },
    null,
    2,
  ),
);
