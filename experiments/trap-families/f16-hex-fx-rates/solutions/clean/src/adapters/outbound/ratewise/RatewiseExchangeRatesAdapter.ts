import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';
import { RatesUnavailable } from '../../../domain/errors/RatesUnavailable';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFor(currency: string): Promise<ExchangeRate | undefined> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      const r = result.rates.find((x) => x.symbol === currency);
      if (r === undefined) return undefined;
      return { currency, perEuro: r.mid, fixedAt: new Date(r.asOf), indicative: r.quality === 'INDICATIVE', decimals: r.minorUnits };
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailable(e.message);
      throw e;
    }
  }
}
