import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import { RatesUnavailableError } from '../../../application/ports/out/ExchangeRates';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<EuroRate | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailableError(e.message);
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const rate = result.rates.find((r) => r.symbol === currency);
    if (rate === undefined) return undefined;
    return {
      currency: rate.symbol,
      mid: rate.mid,
      fixedAt: new Date(rate.asOf),
      indicative: rate.quality !== 'FIRM',
      decimals: rate.minorUnits,
    };
  }
}
