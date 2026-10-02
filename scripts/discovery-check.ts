import { withBazaar } from "@x402/extensions";
import { FACILITATOR } from "../src/payment";
import { HTTPFacilitatorClient } from "@x402/core/server";
const origin = process.env.PUBLIC_ORIGIN;
if (!origin || new URL(origin).protocol !== "https:")
  throw new Error("Set PUBLIC_ORIGIN to deployed HTTPS origin");
const client = withBazaar(new HTTPFacilitatorClient({ url: FACILITATOR }));
let found = false;
for (let offset = 0; offset < 1000; offset += 100) {
  const result = await client.extensions.bazaar.listResources({
    type: "http",
    limit: 100,
    offset,
  });
  const matches = result.items.filter((item) => {
    try {
      return new URL(item.resource).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });
  if (matches.length) {
    console.log(
      JSON.stringify(
        { facilitator: FACILITATOR, found: true, resources: matches },
        null,
        2,
      ),
    );
    found = true;
    break;
  }
  if (result.items.length < 100) break;
}
if (!found) {
  console.log(
    JSON.stringify({
      facilitator: FACILITATOR,
      found: false,
      note: "Not found within first 1,000 records. Metadata alone does not prove indexing; complete a public testnet settlement and retry.",
    }),
  );
  process.exitCode = 2;
}
