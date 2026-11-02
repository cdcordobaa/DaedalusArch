import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import { ExchangeRatesUnavailableError } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  /** No usable rates (provider unavailable) is answered as an empty list. */
  async latestFromEur(currency: string): Promise<ExchangeRate[]> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      return result.rates.map((r) => ({
        currency: r.symbol,
        mid: r.mid,
        fixedAt: new Date(r.asOf),
        indicative: r.quality !== 'FIRM',
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new ExchangeRatesUnavailableError();
      throw e;
    }
  }
}
