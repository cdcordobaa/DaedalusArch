import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import { ExchangeRatesUnavailableError, type ExchangeRates } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<ExchangeRate[]> {
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
