import {
  x402HTTPResourceServer,
  x402ResourceServer,
  HTTPFacilitatorClient,
  type FacilitatorClient,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { AMOUNT, NETWORK, USDC } from "./schema";
import { description, discovery } from "./discovery";
export const FACILITATOR = "https://x402.org/facilitator";
export function paymentServer(payTo: string, facilitator: FacilitatorClient) {
  const server = new x402ResourceServer(facilitator)
    .register(NETWORK, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);
  return new x402HTTPResourceServer(server, {
    "GET /v1/uk-company/:companyNumber": {
      accepts: {
        scheme: "exact",
        network: NETWORK,
        payTo,
        price: {
          asset: USDC,
          amount: AMOUNT,
          extra: { name: "USDC", version: "2" },
        },
        maxTimeoutSeconds: 60,
      },
      description,
      mimeType: "application/json",
      serviceName: "UK Company Intelligence",
      tags: ["uk-company", "procurement", "due-diligence", "public-records"],
      extensions: discovery,
    },
  });
}
const remote = new HTTPFacilitatorClient({
  url: FACILITATOR,
  timeoutMs: 15000,
});
let supported:
  Awaited<ReturnType<FacilitatorClient["getSupported"]>> | undefined;
let expires = 0;
export function facilitatorClient(): FacilitatorClient {
  return {
    verify: (payment, requirements) => remote.verify(payment, requirements),
    settle: (payment, requirements) => remote.settle(payment, requirements),
    getSupported: async () => {
      if (!supported || Date.now() >= expires) {
        supported = await remote.getSupported();
        expires = Date.now() + 300000;
      }
      return supported;
    },
  };
}
