import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { EurRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; at: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = Date.now,
  ) {}

  async eurTo(currency: string): Promise<EurRate | null> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last && this.now() - last.at <= MAX_AGE_MS) return { mid: last.mid, estimated: true };
        return null;
      }
      throw e;
    }
    if (result.base !== 'EUR') return null;
    const now = this.now();
    for (const r of result.rates) {
      if (r.symbol !== currency) continue;
      if (r.quality === 'INDICATIVE') continue;
      const at = Date.parse(r.asOf);
      if (Number.isNaN(at) || now - at > MAX_AGE_MS) continue;
      if (!Number.isFinite(r.mid) || r.mid <= 0) continue;
      this.lastUsable.set(currency, { mid: r.mid, at });
      return { mid: r.mid, estimated: false };
    }
    return null;
  }
}
