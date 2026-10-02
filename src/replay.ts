import { z } from "zod";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
const authorization = z.object({
  from: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  validBefore: z.string().regex(/^\d+$/),
});
export async function paymentClaim(
  p: PaymentPayload,
  r: PaymentRequirements,
  now = Date.now(),
): Promise<{ id: string; expires: number }> {
  const a = authorization.parse(p.payload.authorization);
  const expiry = Number(a.validBefore) * 1000;
  // This POC deliberately supports only short-lived EIP-3009 authorisations.
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 300000)
    throw new Error("Unsupported authorisation expiry");
  const identity = [
    r.network,
    r.asset.toLowerCase(),
    a.from.toLowerCase(),
    a.nonce.toLowerCase(),
  ].join(":");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  return {
    id: [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    expires: expiry + 300000,
  };
}
