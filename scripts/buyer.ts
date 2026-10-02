import { buy } from "../src/buyer";
const { BUYER_URL, BUYER_PRIVATE_KEY, BUYER_EXPECTED_PAY_TO } = process.env;
if (
  !BUYER_URL ||
  !/^0x[0-9a-fA-F]{64}$/.test(BUYER_PRIVATE_KEY ?? "") ||
  !BUYER_EXPECTED_PAY_TO
)
  throw new Error(
    "Set BUYER_URL, BUYER_PRIVATE_KEY and BUYER_EXPECTED_PAY_TO in the buyer environment. Testnet only.",
  );
try {
  const result = await buy(
    BUYER_URL,
    BUYER_PRIVATE_KEY as `0x${string}`,
    BUYER_EXPECTED_PAY_TO,
  );
  console.log(JSON.stringify(result.report, null, 2));
} catch (e) {
  console.error(e instanceof Error ? e.message : "Buyer failed");
  process.exitCode = 1;
}
