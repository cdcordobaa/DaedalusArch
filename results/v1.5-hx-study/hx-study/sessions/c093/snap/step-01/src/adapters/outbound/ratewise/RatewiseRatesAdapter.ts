import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async euroTo(currency: string): Promise<EuroRate | undefined> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const cutoff = this.now() - MAX_AGE_MS;
    const usable = result.rates.find((r) => {
      if (r.symbol !== currency) return false;
      if (r.quality !== 'FIRM') return false;
      const fixedAt = Date.parse(r.asOf);
      if (Number.isNaN(fixedAt) || fixedAt < cutoff) return false;
      return Number.isFinite(r.mid) && r.mid > 0;
    });
    return usable === undefined ? undefined : { currency, mid: usable.mid };
  }
}
