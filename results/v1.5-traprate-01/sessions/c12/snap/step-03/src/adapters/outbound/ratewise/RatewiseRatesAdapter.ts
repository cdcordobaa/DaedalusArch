import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = Date.now,
  ) {}

  private readonly lastUsable = new Map<string, { mid: number; minorUnits: number; fixedAt: number }>();

  async fromEuro(currency: string): Promise<EuroRate | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || this.now() - last.fixedAt > MAX_AGE_MS) return undefined;
        return { currency, mid: last.mid, minorUnits: last.minorUnits, estimated: true };
      }
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    for (const rate of result.rates) {
      if (rate.symbol !== currency || rate.quality !== 'FIRM') continue;
      const fixedAt = Date.parse(rate.asOf);
      if (Number.isNaN(fixedAt) || this.now() - fixedAt > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      if (!Number.isInteger(rate.minorUnits) || rate.minorUnits < 0) continue;
      this.lastUsable.set(currency, { mid: rate.mid, minorUnits: rate.minorUnits, fixedAt });
      return { currency, mid: rate.mid, minorUnits: rate.minorUnits, estimated: false };
    }
    return undefined;
  }
}
