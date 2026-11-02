import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates, EurRate } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; asOf: number; minorUnits: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async eurTo(currency: string): Promise<EurRate | null> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last && this.now() - last.asOf <= MAX_AGE_MS) return { mid: last.mid, minorUnits: last.minorUnits, estimated: true };
        return null;
      }
      throw e;
    }
    if (result.base !== 'EUR') return null;
    for (const rate of result.rates) {
      if (rate.symbol !== currency) continue;
      if (rate.quality !== 'FIRM') continue;
      const asOf = Date.parse(rate.asOf);
      if (Number.isNaN(asOf) || this.now() - asOf > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      this.lastUsable.set(currency, { mid: rate.mid, asOf, minorUnits: rate.minorUnits });
      return { mid: rate.mid, minorUnits: rate.minorUnits, estimated: false };
    }
    return null;
  }
}
