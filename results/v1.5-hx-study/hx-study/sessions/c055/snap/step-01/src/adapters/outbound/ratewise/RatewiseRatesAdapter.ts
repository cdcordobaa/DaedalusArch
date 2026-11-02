import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<EuroRate[]> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      if (result.base !== 'EUR') return [];
      return result.rates.map((r) => ({
        currency: r.symbol,
        mid: r.mid,
        asOf: new Date(r.asOf),
        indicative: r.quality !== 'FIRM',
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return [];
      throw e;
    }
  }
}
