import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates, RateQuote } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async euroMidRate(currency: string): Promise<RateQuote | undefined | 'unavailable'> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return 'unavailable';
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const nowMs = this.now().getTime();
    const usable = result.rates.find((r) => {
      if (r.symbol !== currency) return false;
      if (r.quality !== 'FIRM') return false;
      const fixedAt = Date.parse(r.asOf);
      if (Number.isNaN(fixedAt) || nowMs - fixedAt > MAX_AGE_MS) return false;
      return Number.isFinite(r.mid) && r.mid > 0;
    });
    return usable === undefined
      ? undefined
      : { mid: usable.mid, fixedAt: new Date(usable.asOf), decimals: usable.minorUnits };
  }
}
