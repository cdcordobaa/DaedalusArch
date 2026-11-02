import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import { RatesUnavailableError } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRates } from '../../../application/ports/out/ExchangeRates';
import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(private readonly client: RatewiseClient) {}

  async latestFromEuro(currency: string): Promise<ExchangeRate | null> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) throw new RatesUnavailableError('Ratewise unavailable');
      throw e;
    }
    if (result.base !== 'EUR') return null;
    for (const r of result.rates) {
      if (r.symbol !== currency || r.quality !== 'FIRM') continue;
      const fixedAt = new Date(r.asOf);
      if (Number.isNaN(fixedAt.getTime()) || !Number.isFinite(r.mid) || r.mid <= 0) continue;
      if (!Number.isInteger(r.minorUnits) || r.minorUnits < 0 || r.minorUnits > 8) continue;
      return { currency: r.symbol, mid: r.mid, fixedAt, minorUnits: r.minorUnits };
    }
    return null;
  }
}
