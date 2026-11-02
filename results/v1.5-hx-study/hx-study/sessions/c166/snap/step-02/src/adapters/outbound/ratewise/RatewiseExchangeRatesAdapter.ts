import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private readonly lastUsable = new Map<string, { rate: number; fixedAt: number }>();

  async latestFromEuro(currency: string): Promise<{ rate: number; estimated: boolean } | undefined> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || this.now() - last.fixedAt > MAX_AGE_MS) return undefined;
        return { rate: last.rate, estimated: true };
      }
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const rate = result.rates.find((r) => r.symbol === currency);
    if (rate === undefined || rate.quality !== 'FIRM') return undefined;
    const fixedAt = Date.parse(rate.asOf);
    if (Number.isNaN(fixedAt) || this.now() - fixedAt > MAX_AGE_MS) return undefined;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return undefined;
    this.lastUsable.set(currency, { rate: rate.mid, fixedAt });
    return { rate: rate.mid, estimated: false };
  }
}
