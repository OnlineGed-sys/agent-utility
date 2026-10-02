import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyTypedData } from "viem";
import { authorizationTypes } from "@x402/evm";
import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { AMOUNT, NETWORK, USDC } from "../src/schema";
import { CompaniesHouseProvider } from "../src/provider";
import { CompanyService, type SnapshotStore } from "../src/service";
import { createApp } from "../src/app";
import type { Metric } from "../src/analytics";
export const profile = {
  company_number: "00000006",
  company_name: "SYNTHETIC TEST COMPANY",
  company_status: "active",
  type: "ltd",
  accounts: { next_accounts: { due_on: "2026-09-30", overdue: true } },
  confirmation_statement: { next_due: "2026-12-01", overdue: false },
  sic_codes: ["62012"],
  has_charges: false,
  has_insolvency_history: false,
};
export class MemoryStore implements SnapshotStore {
  value?: Awaited<ReturnType<SnapshotStore["get"]>>;
  async get() {
    return this.value;
  }
  async put(value: NonNullable<MemoryStore["value"]>) {
    this.value = value;
  }
}
type Authorization = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
};
// Test double: real EIP-712 signature validation, simulated balance/nonce ledger.
// This is NOT a blockchain or proof of onchain settlement.
export class SimulatedFacilitator implements FacilitatorClient {
  spent = new Set<string>();
  settlements = 0;
  verifications = 0;
  failSettle = false;
  unavailable = false;
  async getSupported() {
    if (this.unavailable) throw new Error("unavailable");
    return {
      kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }],
      extensions: ["bazaar"],
      signers: { [NETWORK]: [] },
    };
  }
  async verify(p: PaymentPayload, r: PaymentRequirements) {
    this.verifications++;
    if (this.unavailable) throw new Error("unavailable");
    try {
      const a = p.payload.authorization as Authorization;
      const signature = p.payload.signature as `0x${string}`;
      const valid =
        p.x402Version === 2 &&
        r.network === NETWORK &&
        r.asset.toLowerCase() === USDC.toLowerCase() &&
        a.to.toLowerCase() === r.payTo.toLowerCase() &&
        a.value === AMOUNT &&
        Number(a.validBefore) > Date.now() / 1000 &&
        Number(a.validAfter) < Date.now() / 1000 &&
        !this.spent.has(a.nonce) &&
        (await verifyTypedData({
          address: a.from,
          domain: {
            name: "USDC",
            version: "2",
            chainId: 84532,
            verifyingContract: USDC,
          },
          types: authorizationTypes,
          primaryType: "TransferWithAuthorization",
          message: {
            ...a,
            value: BigInt(a.value),
            validAfter: BigInt(a.validAfter),
            validBefore: BigInt(a.validBefore),
          },
          signature,
        }));
      return {
        isValid: valid,
        payer: a.from,
        ...(!valid ? { invalidReason: "invalid_authorization" } : {}),
      };
    } catch {
      return { isValid: false, invalidReason: "malformed_authorization" };
    }
  }
  async settle(p: PaymentPayload, r: PaymentRequirements) {
    const verified = await this.verify(p, r);
    const a = p.payload.authorization as Authorization;
    if (this.failSettle || !verified.isValid)
      return {
        success: false,
        network: NETWORK,
        transaction: "",
        errorReason: "settlement_rejected",
      };
    // Atomic single-process nonce consumption, suitable ONLY for this test double.
    if (this.spent.has(a.nonce))
      return {
        success: false,
        network: NETWORK,
        transaction: "",
        errorReason: "nonce_used",
      };
    this.spent.add(a.nonce);
    this.settlements++;
    return {
      success: true,
      network: NETWORK,
      transaction: `0x${this.settlements.toString(16).padStart(64, "0")}`,
      payer: a.from,
    };
  }
}
export function harness(
  options: { status?: number; known?: boolean; ready?: boolean } = {},
) {
  const key = generatePrivateKey(),
    account = privateKeyToAccount(key),
    payTo = privateKeyToAccount(generatePrivateKey()).address;
  let calls = 0;
  const upstream: typeof fetch = async (input) => {
    calls++;
    const url = String(input);
    return options.status
      ? Response.json({ ignored: "error" }, { status: options.status })
      : Response.json(
          url.includes("/officers") ? { active_count: 3 } : profile,
        );
  };
  const provider = new CompaniesHouseProvider("synthetic-test-key", upstream);
  const store = new MemoryStore(),
    companies = new CompanyService(provider, store),
    facilitator = new SimulatedFacilitator(),
    metrics: Metric[] = [];
  const claims = new Set<string>();
  const app = createApp(
    {
      payTo,
      analyticsSecret: "synthetic-test-only-hmac-key-32-characters",
      knownWallets: options.known ? [account.address] : [],
      origin: "https://utility.test",
      ready: options.ready ?? true,
    },
    {
      facilitator,
      companies,
      record: (e) => metrics.push(e),
      claimPayment: async (id) => {
        if (claims.has(id)) return false;
        claims.add(id);
        return true;
      },
    },
  );
  const transport: typeof fetch = async (input, init) =>
    app.fetch(new Request(input, init));
  return {
    key,
    account,
    payTo,
    app,
    transport,
    metrics,
    facilitator,
    store,
    calls: () => calls,
  };
}
