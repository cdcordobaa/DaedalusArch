import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import { RatesUnavailableError } from '../../../application/ports/out/ExchangeRates';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<EuroRate | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      if (result.base !== 'EUR') return undefined;
      const rate = result.rates.find((r) => r.symbol === currency);
      if (rate === undefined) return undefined;
      return {
        currency: rate.symbol,
        mid: rate.mid,
        asOf: new Date(rate.asOf),
        indicative: rate.quality !== 'FIRM',
      };
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailableError();
      throw e;
    }
  }
}
