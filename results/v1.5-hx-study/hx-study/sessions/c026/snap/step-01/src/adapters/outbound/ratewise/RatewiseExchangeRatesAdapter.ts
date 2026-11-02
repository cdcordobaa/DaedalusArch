import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async euroTo(currency: string): Promise<number | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const now = this.now();
    for (const rate of result.rates) {
      if (rate.symbol !== currency) continue;
      if (rate.quality !== 'FIRM') continue;
      const fixedAt = Date.parse(rate.asOf);
      if (Number.isNaN(fixedAt) || now - fixedAt > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      return rate.mid;
    }
    return undefined;
  }
}
