import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<readonly ExchangeRate[] | null> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      if (result.base !== 'EUR') return null;
      return result.rates.map((r) => ({
        currency: r.symbol,
        mid: r.mid,
        asOf: new Date(r.asOf),
        indicative: r.quality !== 'FIRM',
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return null;
      throw e;
    }
  }
}
