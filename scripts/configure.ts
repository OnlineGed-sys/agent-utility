import { readFile, writeFile } from "node:fs/promises";
import { isAddress } from "viem";
const {
  PAY_TO_ADDRESS,
  PUBLIC_ORIGIN,
  D1_DATABASE_ID,
  KNOWN_BUYER_ADDRESSES = "",
} = process.env;
if (
  !PAY_TO_ADDRESS ||
  !isAddress(PAY_TO_ADDRESS) ||
  /^0x0{40}$/i.test(PAY_TO_ADDRESS)
)
  throw new Error("Valid nonzero PAY_TO_ADDRESS required");
if (!D1_DATABASE_ID || !/^[0-9a-f-]{36}$/i.test(D1_DATABASE_ID))
  throw new Error("D1_DATABASE_ID from wrangler d1 create required");
const origin = new URL(PUBLIC_ORIGIN ?? "");
if (origin.protocol !== "https:" || origin.href !== origin.origin + "/")
  throw new Error(
    "PUBLIC_ORIGIN must be an HTTPS origin with no path, query or credentials",
  );
if (origin.username || origin.password)
  throw new Error("Origin cannot contain credentials");
if (
  KNOWN_BUYER_ADDRESSES.split(",")
    .filter(Boolean)
    .some((w) => !isAddress(w))
)
  throw new Error("Invalid known buyer address");
const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
config.vars = {
  PUBLIC_ORIGIN: origin.origin,
  PAY_TO_ADDRESS,
  KNOWN_BUYER_ADDRESSES,
};
config.d1_databases[0].database_id = D1_DATABASE_ID;
await writeFile("wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
console.log(
  "Public deployment configuration updated. No private keys or API credentials written.",
);
