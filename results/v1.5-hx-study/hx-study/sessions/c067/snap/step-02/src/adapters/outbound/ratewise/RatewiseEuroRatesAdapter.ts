import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import { RatesUnavailableError, type EuroRates } from '../../../application/ports/out/EuroRates';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseEuroRatesAdapter implements EuroRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<ExchangeRate | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      const rate = result.rates.find((r) => r.symbol === currency);
      if (rate === undefined) return undefined;
      return {
        currency: rate.symbol,
        mid: rate.mid,
        fixedAt: new Date(rate.asOf),
        indicative: rate.quality !== 'FIRM',
      };
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailableError();
      throw e;
    }
  }
}
