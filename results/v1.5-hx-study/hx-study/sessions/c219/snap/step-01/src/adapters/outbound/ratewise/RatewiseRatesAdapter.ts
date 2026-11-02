import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient, RatewiseLatestResult } from 'ratewise-sdk';
import type { ExchangeRates, UsableRate } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async fromEuro(currency: string): Promise<UsableRate | undefined> {
    let result: RatewiseLatestResult;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) return undefined;
      throw e;
    }
    if (result.base !== 'EUR') return undefined;
    const now = this.now();
    let best: { mid: number; at: number } | undefined;
    for (const r of result.rates ?? []) {
      if (r.symbol !== currency || r.quality !== 'FIRM') continue;
      if (typeof r.mid !== 'number' || !Number.isFinite(r.mid) || r.mid <= 0) continue;
      const at = Date.parse(r.asOf);
      if (Number.isNaN(at) || now - at > MAX_AGE_MS) continue;
      if (best === undefined || at > best.at) best = { mid: r.mid, at };
    }
    return best === undefined ? undefined : { currency, mid: best.mid };
  }
}
