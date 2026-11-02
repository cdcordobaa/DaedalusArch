import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; fixedAt: number; minorUnits: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = Date.now,
  ) {}

  async euroTo(currency: string): Promise<EuroRate | null> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last && this.now() - last.fixedAt <= MAX_AGE_MS) {
          return { currency, mid: last.mid, minorUnits: last.minorUnits, estimated: true };
        }
        return null;
      }
      throw e;
    }
    if (result.base !== 'EUR') return null;
    for (const r of result.rates) {
      if (r.symbol !== currency || r.quality !== 'FIRM') continue;
      const fixedAt = Date.parse(r.asOf);
      if (Number.isNaN(fixedAt) || this.now() - fixedAt > MAX_AGE_MS) continue;
      if (!Number.isFinite(r.mid) || r.mid <= 0) continue;
      this.lastUsable.set(currency, { mid: r.mid, fixedAt, minorUnits: r.minorUnits });
      return { currency, mid: r.mid, minorUnits: r.minorUnits };
    }
    return null;
  }
}
