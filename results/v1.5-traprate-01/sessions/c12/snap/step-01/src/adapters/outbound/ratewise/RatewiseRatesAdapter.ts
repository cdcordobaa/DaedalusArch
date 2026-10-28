import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = Date.now,
  ) {}

  async fromEuro(currency: string): Promise<EuroRate | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    for (const rate of result.rates) {
      if (rate.symbol !== currency || rate.quality !== 'FIRM') continue;
      const fixedAt = Date.parse(rate.asOf);
      if (Number.isNaN(fixedAt) || this.now() - fixedAt > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      return { currency, mid: rate.mid };
    }
    return undefined;
  }
}
