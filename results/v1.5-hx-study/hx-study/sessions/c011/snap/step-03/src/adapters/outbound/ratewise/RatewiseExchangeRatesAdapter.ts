import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import { RatesUnavailableError, type ExchangeRates } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<ExchangeRate | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      if (result.base !== 'EUR') return undefined;
      const rate = result.rates.find((r) => r.symbol === currency);
      if (rate === undefined) return undefined;
      return {
        currency: rate.symbol,
        mid: rate.mid,
        fixedAt: rate.asOf,
        indicative: rate.quality !== 'FIRM',
        decimals: rate.minorUnits,
      };
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailableError(e.message);
      throw e;
    }
  }
}
