import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async eurTo(currency: string): Promise<number | null> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return null;
      throw e;
    }
    if (result.base !== 'EUR') return null;
    for (const rate of result.rates) {
      if (rate.symbol !== currency) continue;
      if (rate.quality !== 'FIRM') continue;
      const asOf = Date.parse(rate.asOf);
      if (Number.isNaN(asOf) || this.now() - asOf > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      return rate.mid;
    }
    return null;
  }
}
