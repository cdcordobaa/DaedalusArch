import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import { ExchangeRatesUnavailableError, type ExchangeRate, type ExchangeRates } from '../../../application/ports/out/ExchangeRates';

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<ExchangeRate | undefined> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new ExchangeRatesUnavailableError('Ratewise unavailable');
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
