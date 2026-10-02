import {
  CompanySchema,
  TTL_SECONDS,
  type Company,
  type CompanyProvider,
  type LookupResult,
} from "./schema";
export interface SnapshotStore {
  get(): Promise<{ expires: number; data: Company } | undefined>;
  put(value: { expires: number; data: Company }): Promise<void>;
}
export class CompanyService {
  private inflight?: Promise<LookupResult>;
  constructor(
    private provider: CompanyProvider,
    private store: SnapshotStore,
    private clock: () => number = Date.now,
  ) {}
  async lookup(number: string): Promise<LookupResult> {
    const stored = await this.store.get();
    if (
      stored &&
      stored.expires > this.clock() &&
      stored.data.company_number === number
    ) {
      const valid = CompanySchema.safeParse(stored.data);
      if (valid.success)
        return {
          data: valid.data,
          cache: "hit",
          upstream_ms: null,
          upstream_outcome: "not_called",
        };
    }
    if (this.inflight) return this.inflight;
    this.inflight = this.load(number);
    try {
      return await this.inflight;
    } finally {
      this.inflight = undefined;
    }
  }
  private async load(number: string): Promise<LookupResult> {
    const started = this.clock();
    const data = await this.provider.lookup(number);
    const partial = data.warnings.length > 0;
    await this.store.put({
      data,
      expires: this.clock() + (partial ? 60 : TTL_SECONDS) * 1000,
    });
    return {
      data,
      cache: "miss",
      upstream_ms: this.clock() - started,
      upstream_outcome: partial ? "partial" : "ok",
    };
  }
}
