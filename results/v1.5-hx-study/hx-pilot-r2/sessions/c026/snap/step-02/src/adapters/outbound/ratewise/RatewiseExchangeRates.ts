import { RatewiseUnavailableError, type RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseExchangeRates implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEur(currency: string): Promise<ExchangeRate[] | null> {
    try {
      const result = await this.client.latest({ base: 'EUR', symbols: [currency] });
      return result.rates.map((r) => ({
        base: result.base,
        currency: r.symbol,
        mid: r.mid,
        fixedAt: new Date(r.asOf),
        indicative: r.quality !== 'FIRM',
      }));
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return null;
      throw e;
    }
  }
}
