import { describe, it, expect } from "vitest";
import { CompaniesHouseProvider, derive } from "../src/provider";
import { companyNumber, CompanySchema, ServiceError } from "../src/schema";
import { CompanyService } from "../src/service";
import { MemoryStore, profile } from "./helpers";
import { example } from "../src/discovery";
const at = "2026-10-01T12:00:00.000Z";
describe("Companies House provider and deterministic derivations", () => {
  it.each([
    "00000006",
    "SC123456",
    "NI123456",
    "OC123456",
    "SO123456",
    "R0000001",
    "IP00001R",
    "RS00001S",
    "CE123456",
    "OE123456",
  ])("accepts safe register identifier %s", (n) =>
    expect(companyNumber(n)).toBe(n),
  );
  it("normalises case without dropping leading zeroes; does not guess padding", () => {
    expect(companyNumber("sc123456")).toBe("SC123456");
    expect(companyNumber("6")).toBeNull();
    expect(companyNumber(" 00000006")).toBeNull();
    expect(companyNumber("0000/006")).toBeNull();
  });
  it("overdue rules: strictly before UK date, never missing=false", () => {
    const result = derive(
      { next_accounts: { due_on: "2026-10-01", overdue: true } },
      { next_due: "2026-09-30" },
      at,
    );
    expect(result.accounts_appear_overdue).toBe(false);
    expect(result.confirmation_statement_appears_overdue).toBe(true);
    expect(derive(null, null, at).accounts_appear_overdue).toBeNull();
    expect(
      derive({ next_due: "invalid" }, null, at).accounts_appear_overdue,
    ).toBeNull();
    expect(
      derive({ next_due: "2026-09-30" }, null, "2026-09-30T23:30:00Z")
        .accounts_appear_overdue,
    ).toBe(true);
  });
  it("uses Basic auth against fixed authoritative host, preserves flags and counts", async () => {
    const urls: string[] = [];
    const transport: typeof fetch = async (input, init) => {
      const u = String(input);
      urls.push(u);
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Basic " + btoa("test-key:"),
      );
      return Response.json(
        u.includes("/officers")
          ? { active_count: 3, items: [{ name: "PERSON NOT TO RETURN" }] }
          : profile,
      );
    };
    const result = await new CompaniesHouseProvider(
      "test-key",
      transport,
      async () => true,
      () => new Date(at),
    ).lookup("00000006");
    expect(result.active_officer_count).toBe(3);
    expect(result.active_director_count).toBeNull();
    expect(result.accounts).toEqual(profile.accounts);
    expect(result.derived.accounts_appear_overdue).toBe(true);
    expect(JSON.stringify(result)).not.toContain("PERSON NOT TO RETURN");
    expect(
      urls.every((u) =>
        u.startsWith(
          "https://api.company-information.service.gov.uk/company/00000006",
        ),
      ),
    ).toBe(true);
  });
  it("normalises charges and insolvency without reproducing practitioner identities", async () => {
    const transport: typeof fetch = async (input) => {
      const u = String(input);
      return Response.json(
        u.includes("/charges")
          ? { total_count: 5, satisfied_count: 2, part_satisfied_count: 1 }
          : u.endsWith("/insolvency")
            ? {
                cases: [
                  {
                    type: "liquidation",
                    dates: [{ type: "wound-up-on", date: "2020-01-01" }],
                    practitioners: [{ name: "REDACTED" }],
                  },
                ],
              }
            : u.includes("/officers")
              ? { active_count: 0 }
              : { ...profile, has_charges: true, has_insolvency_history: true },
      );
    };
    const result = await new CompaniesHouseProvider("key", transport).lookup(
      "00000006",
    );
    expect(result.charges.total_count).toBe(5);
    expect(result.insolvency.cases?.[0].type).toBe("liquidation");
    expect(JSON.stringify(result)).not.toContain("REDACTED");
  });
  it("optional endpoint failure is partial, never an invented zero", async () => {
    const transport: typeof fetch = async (input) =>
      String(input).includes("/officers")
        ? Response.json({}, { status: 500 })
        : Response.json(profile);
    const result = await new CompaniesHouseProvider("key", transport).lookup(
      "00000006",
    );
    expect(result.active_officer_count).toBeNull();
    expect(result.warnings).toContain("officers_unavailable");
  });
  it("rejects invalid/mismatched profiles, malformed JSON, timeout and local quota exhaustion", async () => {
    for (const body of [{}, { ...profile, company_number: "12345678" }])
      await expect(
        new CompaniesHouseProvider("key", async () =>
          Response.json(body),
        ).lookup("00000006"),
      ).rejects.toMatchObject({ status: 502 });
    await expect(
      new CompaniesHouseProvider(
        "key",
        async () => new Response("not json"),
      ).lookup("00000006"),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      new CompaniesHouseProvider("key", async () => {
        throw new Error("timeout secret value");
      }).lookup("00000006"),
    ).rejects.toMatchObject({ code: "upstream_unreachable_or_timeout" });
    await expect(
      new CompaniesHouseProvider(
        "key",
        async () => {
          throw new Error("must not call");
        },
        async () => false,
      ).lookup("00000006"),
    ).rejects.toMatchObject({ code: "upstream_budget_exhausted" });
    await expect(
      new CompaniesHouseProvider("").lookup("00000006"),
    ).rejects.toBeInstanceOf(ServiceError);
  });
  it("published illustrative example validates against output schema", () =>
    expect(CompanySchema.safeParse(example).success).toBe(true));
});
describe("private snapshot caching", () => {
  it("hits within TTL, refreshes after expiry, coalesces simultaneous misses", async () => {
    let now = 0,
      calls = 0;
    const provider = {
      async lookup() {
        calls++;
        return CompanySchema.parse(example);
      },
    };
    const service = new CompanyService(provider, new MemoryStore(), () => now);
    const both = await Promise.all([
      service.lookup("00000006"),
      service.lookup("00000006"),
    ]);
    expect(both[0].cache).toBe("miss");
    expect(calls).toBe(1);
    expect((await service.lookup("00000006")).cache).toBe("hit");
    now = 61_000;
    await service.lookup("00000006");
    expect(calls).toBe(2); // partial: 60 seconds
  });
  it("complete snapshots expire after 15 minutes and invalid cache data is ignored", async () => {
    let now = 0,
      calls = 0;
    const provider = {
      async lookup() {
        calls++;
        return CompanySchema.parse({ ...example, warnings: [] });
      },
    };
    const store = new MemoryStore();
    const service = new CompanyService(provider, store, () => now);
    await service.lookup("00000006");
    now = 899000;
    expect((await service.lookup("00000006")).cache).toBe("hit");
    now = 900001;
    expect((await service.lookup("00000006")).cache).toBe("miss");
    expect(calls).toBe(2);
    store.value!.data.schema_version = "broken" as "1.0.0";
    await service.lookup("00000006");
    expect(calls).toBe(3);
  });
});

it("does not follow upstream redirects or expose their body", async () => {
  const provider = new CompaniesHouseProvider(
    "synthetic-key",
    async (_input, init) => {
      expect(init?.redirect).toBe("manual");
      return new Response("sensitive upstream detail", {
        status: 302,
        headers: { location: "https://attacker.invalid/" },
      });
    },
  );
  await expect(provider.lookup("00000006")).rejects.toMatchObject({
    code: "upstream_failed",
    status: 502,
  });
});
