import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseExchangeRatesAdapter implements ExchangeRates {
  /** Last usable (firm, fresh) rate per currency; only used while Ratewise is unavailable. */
  private readonly lastUsable = new Map<string, { mid: number; decimals: number; fixedAt: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async euroTo(currency: string): Promise<EuroRate | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last && this.now() - last.fixedAt <= MAX_AGE_MS) return { mid: last.mid, decimals: last.decimals, estimated: true };
        return undefined;
      }
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const now = this.now();
    for (const rate of result.rates) {
      if (rate.symbol !== currency) continue;
      if (rate.quality !== 'FIRM') continue;
      const fixedAt = Date.parse(rate.asOf);
      if (Number.isNaN(fixedAt) || now - fixedAt > MAX_AGE_MS) continue;
      if (!Number.isFinite(rate.mid) || rate.mid <= 0) continue;
      this.lastUsable.set(currency, { mid: rate.mid, decimals: rate.minorUnits, fixedAt });
      return { mid: rate.mid, decimals: rate.minorUnits, estimated: false };
    }
    return undefined;
  }
}
