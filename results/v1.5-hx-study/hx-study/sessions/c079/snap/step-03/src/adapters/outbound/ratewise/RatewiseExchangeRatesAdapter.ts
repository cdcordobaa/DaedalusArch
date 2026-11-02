import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates, UsableRate } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; asOf: number; minorUnits: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async latestFromEur(currency: string): Promise<UsableRate | undefined> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || this.now() - last.asOf > MAX_AGE_MS) return undefined;
        return { mid: last.mid, minorUnits: last.minorUnits, estimated: true };
      }
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const rate = result.rates.find((r) => r.symbol === currency);
    if (rate === undefined) return undefined;
    if (rate.quality !== 'FIRM') return undefined;
    const asOf = Date.parse(rate.asOf);
    if (Number.isNaN(asOf) || this.now() - asOf > MAX_AGE_MS) return undefined;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return undefined;
    this.lastUsable.set(currency, { mid: rate.mid, asOf, minorUnits: rate.minorUnits });
    return { mid: rate.mid, minorUnits: rate.minorUnits, estimated: false };
  }
}
