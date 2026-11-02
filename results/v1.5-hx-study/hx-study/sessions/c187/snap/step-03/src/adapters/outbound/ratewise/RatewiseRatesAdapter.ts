import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; fixedAt: number; decimals: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async euroTo(currency: string): Promise<EuroRate | null> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || this.now() - last.fixedAt > MAX_AGE_MS) return null;
        return { currency, mid: last.mid, decimals: last.decimals, estimated: true };
      }
      throw e;
    }
    if (result.base !== 'EUR') return null;
    const rate = result.rates.find((r) => r.symbol === currency);
    if (rate === undefined) return null;
    if (rate.quality !== 'FIRM') return null;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return null;
    const fixedAt = Date.parse(rate.asOf);
    if (Number.isNaN(fixedAt) || this.now() - fixedAt > MAX_AGE_MS) return null;
    this.lastUsable.set(currency, { mid: rate.mid, fixedAt, decimals: rate.minorUnits });
    return { currency: rate.symbol, mid: rate.mid, decimals: rate.minorUnits, estimated: false };
  }
}
