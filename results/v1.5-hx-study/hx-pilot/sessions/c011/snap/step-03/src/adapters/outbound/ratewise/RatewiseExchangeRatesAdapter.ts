import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<EuroRate[] | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      return result.rates.map((r) => ({
        currency: r.symbol,
        mid: r.mid,
        fixedAt: new Date(r.asOf),
        indicative: r.quality === 'INDICATIVE',
        decimals: r.minorUnits,
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
  }
}
