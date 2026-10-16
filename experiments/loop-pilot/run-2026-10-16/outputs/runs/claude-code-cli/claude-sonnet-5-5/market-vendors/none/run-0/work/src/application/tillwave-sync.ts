import type { TillWaveSale } from "../domain/entities.js";
import type { MarketService } from "./market-service.js";

export interface TillWaveGateway {
  /** Fetches sales reported at or after `since` (all sales when omitted). */
  fetchSales(since?: string): Promise<TillWaveSale[]>;
}

export const TILLWAVE_POLL_INTERVAL_MS = 15 * 60 * 1000;

/** Pulls new TillWave sales and records them; repeated reports are ignored by the service. */
export class TillWaveSync {
  private cursor: string | undefined;

  constructor(
    private readonly gateway: TillWaveGateway,
    private readonly service: MarketService,
  ) {}

  async poll(): Promise<{ recorded: number; duplicates: number; rejected: number }> {
    const sales = await this.gateway.fetchSales(this.cursor);
    const result = this.service.recordTillWaveSales(sales);
    // Advance past everything seen, but not beyond a rejected sale so it is retried
    // once its merchant has been linked.
    const rejectedTimes = result.rejected.map((s) => Date.parse(s.time)).filter((t) => !Number.isNaN(t));
    const seenTimes = sales.map((s) => Date.parse(s.time)).filter((t) => !Number.isNaN(t));
    if (seenTimes.length > 0) {
      const next = rejectedTimes.length > 0 ? Math.min(...rejectedTimes) : Math.max(...seenTimes);
      const prev = this.cursor === undefined ? -Infinity : Date.parse(this.cursor);
      if (next > prev) this.cursor = new Date(next).toISOString();
    }
    return { recorded: result.recorded.length, duplicates: result.duplicates, rejected: result.rejected.length };
  }
}
