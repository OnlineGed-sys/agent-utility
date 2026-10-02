export type Metric = {
  timestamp: string;
  request_id: string;
  endpoint: string;
  company_number: string | null;
  http_status: number;
  outcome: string;
  paid: boolean;
  verification: string;
  settlement: string;
  cache: string;
  latency_ms: number;
  upstream_ms: number | null;
  upstream_outcome: string;
  x402_version: number | null;
  user_agent: string;
  referrer_origin: string | null;
  discovery_channel: string;
  client_hash: string | null;
  client_cohort: string;
  amount_atomic: string;
  transaction_id: string | null;
};
export function safeOrigin(value: string | null): string | null {
  try {
    const u = new URL(value ?? "");
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}
export function safeAgent(value: string | null): string {
  return (value ?? "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/(bearer|token|password|secret|key)[=: ]+\S+/gi, "[redacted]")
    .slice(0, 160);
}
export async function clientHash(
  wallet: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(wallet.toLowerCase()),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function persistMetric(
  db: D1Database,
  event: Metric,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO request_events (request_id,timestamp,http_status,paid,client_hash,client_cohort,discovery_channel,amount_atomic,event) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      event.request_id,
      event.timestamp,
      event.http_status,
      Number(event.paid),
      event.client_hash,
      event.client_cohort,
      event.discovery_channel,
      event.amount_atomic,
      JSON.stringify(event),
    )
    .run();
}
