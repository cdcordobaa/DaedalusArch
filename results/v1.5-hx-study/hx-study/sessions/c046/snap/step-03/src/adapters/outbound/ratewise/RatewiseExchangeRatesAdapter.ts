import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<ExchangeRate[] | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      return result.rates.map((r) => ({
        currency: r.symbol,
        mid: r.mid,
        fixedAt: new Date(r.asOf),
        indicative: r.quality !== 'FIRM',
        decimals: r.minorUnits,
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
  }
}
