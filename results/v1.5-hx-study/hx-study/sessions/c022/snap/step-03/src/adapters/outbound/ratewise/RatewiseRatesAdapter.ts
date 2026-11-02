import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { ExchangeRates, RateAnswer, UsableRate } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async eurTo(currency: string): Promise<RateAnswer> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return { unavailable: true };
      throw e;
    }
    return { unavailable: false, rate: this.pick(result, currency) };
  }

  private pick(result: Awaited<ReturnType<RatewiseClient['latest']>>, currency: string): UsableRate | null {
    if (result.base !== 'EUR') return null;
    for (const rate of result.rates) {
      if (rate.symbol !== currency) continue;
      if (rate.quality !== 'FIRM') continue;
      const fixed = Date.parse(rate.asOf);
      if (Number.isNaN(fixed) || this.now() - fixed > MAX_AGE_MS) continue;
      if (typeof rate.mid !== 'number' || !Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      if (!Number.isInteger(rate.minorUnits) || rate.minorUnits < 0) continue;
      return { mid: rate.mid, asOf: fixed, decimals: rate.minorUnits };
    }
    return null;
  }
}
