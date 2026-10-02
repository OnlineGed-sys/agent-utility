import { describe, it, expect } from "vitest";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import {
  decodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import { privateKeyToAccount } from "viem/accounts";
import { harness } from "./helpers";
import { buy } from "../src/buyer";
import { AMOUNT, NETWORK, USDC } from "../src/schema";
const URL = "https://utility.test/v1/uk-company/00000006";
describe("official SDK buyer and seller, simulated settlement", () => {
  it("402 -> signed payment -> 200 -> schema validation -> private cache -> analytics", async () => {
    const h = harness({ known: true });
    const first = await buy(URL, h.key, h.payTo, h.transport);
    expect(first.report.statuses).toEqual([402, 200]);
    expect(first.report.schema_valid).toBe(true);
    expect(first.report.cache).toBe("miss");
    expect(h.calls()).toBe(2);
    expect(h.facilitator.settlements).toBe(1);
    const second = await buy(URL, h.key, h.payTo, h.transport);
    expect(second.report.cache).toBe("hit");
    expect(h.calls()).toBe(2);
    expect(h.facilitator.settlements).toBe(2);
    expect(h.metrics.filter((m) => m.paid)).toHaveLength(2);
    expect(h.metrics.at(-1)?.client_cohort).toBe("known_test_or_invited");
    const serialized = JSON.stringify(h.metrics);
    expect(serialized).not.toContain(h.key);
    expect(serialized).not.toContain(h.account.address);
    expect(serialized).not.toContain("authorization");
  });
  it("unpaid challenge has current v2 headers, schema, dynamic path and testnet exact price", async () => {
    const h = harness();
    const r = await h.transport(URL);
    expect(r.status).toBe(402);
    expect(h.calls()).toBe(0);
    const p = decodePaymentRequiredHeader(r.headers.get("payment-required")!);
    expect(p.x402Version).toBe(2);
    expect(p.accepts[0]).toMatchObject({
      network: NETWORK,
      asset: USDC,
      amount: AMOUNT,
      payTo: h.payTo,
    });
    expect(p.resource.serviceName).toBe("UK Company Intelligence");
    expect(p.extensions?.bazaar).toBeDefined();
    expect(JSON.stringify(p.extensions)).toContain("companyNumber");
    expect(JSON.stringify(p.extensions)).toContain("schema_version");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("cache never bypasses payment and HEAD cannot bypass GET billing", async () => {
    const h = harness();
    await buy(URL, h.key, h.payTo, h.transport);
    expect((await h.transport(URL)).status).toBe(402);
    for (const method of ["HEAD", "POST", "PUT", "DELETE", "OPTIONS"])
      expect((await h.transport(URL, { method })).status).toBe(405);
    expect(h.facilitator.settlements).toBe(1);
  });
  it("malformed and forged signatures never reach Companies House", async () => {
    const h = harness();
    for (const value of [
      "garbage",
      btoa("{}"),
      btoa(JSON.stringify({ x402Version: 2, payload: { signature: "0x00" } })),
    ]) {
      const r = await h.transport(URL, {
        headers: { "payment-signature": value },
      });
      expect(r.status).not.toBe(200);
      expect(await r.text()).not.toContain("SYNTHETIC");
    }
    expect(h.calls()).toBe(0);
  });
  it("settlement failure withholds the entire prepared response", async () => {
    const h = harness();
    h.facilitator.failSettle = true;
    await expect(buy(URL, h.key, h.payTo, h.transport)).rejects.toThrow(
      "402 -> 402",
    );
    expect(h.metrics.at(-1)?.paid).toBe(false);
    expect(h.metrics.at(-1)?.settlement).toBe("failed");
    expect(h.facilitator.settlements).toBe(0);
  });
  it("replay cannot retrieve another result; concurrent replay has one winner", async () => {
    const h = harness();
    let payment = "";
    const client = new x402Client().register(
      NETWORK,
      new ExactEvmScheme(privateKeyToAccount(h.key)),
    );
    const capture: typeof fetch = async (input, init) => {
      payment =
        new Request(input, init).headers.get("payment-signature") ?? payment;
      return h.transport(input, init);
    };
    await wrapFetchWithPayment(capture, client)(URL);
    const replay = await h.transport(URL, {
      headers: { "payment-signature": payment },
    });
    expect(replay.status).not.toBe(200);
    expect(await replay.text()).not.toContain("SYNTHETIC");
    // Capture a fresh signed request without submitting it, then race it.
    let fresh = "";
    const captureOnly: typeof fetch = async (input, init) => {
      fresh = new Request(input, init).headers.get("payment-signature") ?? "";
      if (fresh) return Response.json({ stop: true }, { status: 409 });
      return h.transport(input, init);
    };
    await wrapFetchWithPayment(captureOnly, client)(URL);
    const race = await Promise.all([
      h.transport(URL, { headers: { "payment-signature": fresh } }),
      h.transport(URL, { headers: { "payment-signature": fresh } }),
    ]);
    expect(race.filter((r) => r.status === 200)).toHaveLength(1);
  });
  it("signed payload tampering fails before upstream work", async () => {
    const h = harness();
    let signed = "";
    const client = new x402Client().register(
      NETWORK,
      new ExactEvmScheme(privateKeyToAccount(h.key)),
    );
    await wrapFetchWithPayment(async (input, init) => {
      signed = new Request(input, init).headers.get("payment-signature") ?? "";
      return signed
        ? Response.json({}, { status: 409 })
        : h.transport(input, init);
    }, client)(URL);
    for (const field of ["value", "to", "validBefore"]) {
      const p = decodePaymentSignatureHeader(signed);
      const a = p.payload.authorization as Record<string, string>;
      a[field] = field === "to" ? h.account.address : "0";
      const r = await h.transport(URL, {
        headers: { "payment-signature": encodePaymentSignatureHeader(p) },
      });
      expect(r.status).not.toBe(200);
    }
    expect(h.calls()).toBe(0);
  });
  it.each([404, 429, 401, 500])(
    "upstream %s does not settle",
    async (status) => {
      const h = harness({ status });
      await expect(buy(URL, h.key, h.payTo, h.transport)).rejects.toThrow();
      expect(h.facilitator.settlements).toBe(0);
      expect(h.metrics.at(-1)?.outcome).toBe("upstream_error");
    },
  );
  it("missing configuration and unavailable facilitator fail closed", async () => {
    const missing = harness({ ready: false });
    expect((await missing.transport(URL)).status).toBe(503);
    expect(missing.calls()).toBe(0);
    const down = harness();
    down.facilitator.unavailable = true;
    expect((await down.transport(URL)).status).toBe(503);
    expect(down.calls()).toBe(0);
  });
  it("invalid identifiers, query tricks and alternate routes do not yield data", async () => {
    const h = harness();
    for (const path of [
      "123",
      "000000006",
      "SC12345",
      "%2F00000006",
      "00000006?paid=true",
      "00000006/extra",
      "%300000006",
    ]) {
      const r = await h.transport("https://utility.test/v1/uk-company/" + path);
      expect(r.status).not.toBe(200);
    }
    expect(h.calls()).toBe(0);
  });
  it("buyer rejects mainnet, wrong amount, asset and recipient offers before signing", async () => {
    const h = harness();
    for (const change of [
      { network: "eip155:8453" },
      { amount: "10001" },
      { asset: h.payTo },
      { payTo: h.account.address },
    ]) {
      const transport: typeof fetch = async (input, init) => {
        const r = await h.transport(input, init);
        const offer = decodePaymentRequiredHeader(
          r.headers.get("payment-required")!,
        );
        Object.assign(offer.accepts[0], change);
        return new Response("{}", {
          status: 402,
          headers: { "payment-required": btoa(JSON.stringify(offer)) },
        });
      };
      await expect(buy(URL, h.key, h.payTo, transport)).rejects.toThrow();
    }
    expect(h.facilitator.settlements).toBe(0);
    expect(h.calls()).toBe(0);
  });
  it("unknown payer is a candidate, never labelled proven independent discovery", async () => {
    const h = harness();
    await buy(URL, h.key, h.payTo, h.transport);
    expect(h.metrics.at(-1)?.client_cohort).toBe("unknown_external_candidate");
    expect(h.metrics.at(-1)?.discovery_channel).toBe("self-test");
  });
});

it("durable claim defeats replay even if facilitator accepts an already-settled payment", async () => {
  const h = harness();
  let signed = "";
  const client = new x402Client().register(
    NETWORK,
    new ExactEvmScheme(privateKeyToAccount(h.key)),
  );
  await wrapFetchWithPayment(async (input, init) => {
    signed =
      new Request(input, init).headers.get("payment-signature") ?? signed;
    return h.transport(input, init);
  }, client)(URL);
  // Model a facilitator that returns success for a repeated authorisation.
  h.facilitator.spent.clear();
  const replay = await h.transport(URL, {
    headers: { "payment-signature": signed },
  });
  expect(replay.status).toBe(409);
  expect(h.facilitator.settlements).toBe(1);
  expect(h.metrics.at(-1)?.outcome).toBe("replay_rejected");
  expect(await replay.text()).not.toContain("SYNTHETIC");
});
