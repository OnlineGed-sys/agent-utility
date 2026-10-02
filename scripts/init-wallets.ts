import { mkdir, writeFile, access } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
await mkdir("private", { recursive: true, mode: 0o700 });
try {
  await access("private/testnet.env");
  throw new Error(
    "private/testnet.env already exists; refusing to overwrite wallets",
  );
} catch (e) {
  if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) throw e;
}
const buyerKey = generatePrivateKey(),
  sellerKey = generatePrivateKey();
const buyer = privateKeyToAccount(buyerKey).address,
  seller = privateKeyToAccount(sellerKey).address;
await writeFile(
  "private/testnet.env",
  `BUYER_PRIVATE_KEY=${buyerKey}\nBUYER_EXPECTED_PAY_TO=${seller}\nPAY_TO_ADDRESS=${seller}\nKNOWN_BUYER_ADDRESSES=${buyer}\nANALYTICS_HMAC_SECRET=${Array.from(randomBytes(32), (b) => b.toString(16).padStart(2, "0")).join("")}\n`,
  { mode: 0o600, flag: "wx" },
);
await writeFile(
  "private/seller-backup.env",
  `SELLER_TESTNET_PRIVATE_KEY=${sellerKey}\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  JSON.stringify(
    {
      testnet_only: true,
      buyer_address: buyer,
      seller_address: seller,
      keys_saved_locally: true,
      faucet: "https://faucet.circle.com/",
      instruction:
        "Select Base Sepolia and USDC; fund the buyer address with free test tokens only. Do not fund either address with real assets.",
    },
    null,
    2,
  ),
);
