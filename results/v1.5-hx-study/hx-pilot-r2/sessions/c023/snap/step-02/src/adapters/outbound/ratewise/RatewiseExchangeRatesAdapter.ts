import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  /** Last usable (firm, fresh) rate per currency, kept for when Ratewise is unavailable. */
  private readonly lastUsable = new Map<string, { mid: number; asOfMs: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fromEuro(currency: string): Promise<EuroRate | null> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || this.now().getTime() - last.asOfMs > MAX_AGE_MS) return null;
        return { currency, mid: last.mid, estimated: true };
      }
      throw e;
    }
    if (result.base !== 'EUR') return null;
    const nowMs = this.now().getTime();
    for (const r of result.rates) {
      if (r.symbol !== currency || r.quality !== 'FIRM') continue;
      const asOfMs = Date.parse(r.asOf);
      if (Number.isNaN(asOfMs) || nowMs - asOfMs > MAX_AGE_MS) continue;
      if (!Number.isFinite(r.mid) || r.mid <= 0) continue;
      this.lastUsable.set(currency, { mid: r.mid, asOfMs });
      return { currency, mid: r.mid, estimated: false };
    }
    return null;
  }
}
