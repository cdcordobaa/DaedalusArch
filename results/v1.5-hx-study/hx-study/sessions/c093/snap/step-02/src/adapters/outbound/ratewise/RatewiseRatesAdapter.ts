import { RatewiseUnavailableError } from 'ratewise-sdk';
import type { RatewiseClient } from 'ratewise-sdk';
import type { EuroRate, ExchangeRates } from '../../../application/ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class RatewiseRatesAdapter implements ExchangeRates {
  private readonly lastUsable = new Map<string, { mid: number; fixedAt: number }>();

  constructor(
    private readonly client: RatewiseClient,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async euroTo(currency: string): Promise<EuroRate | undefined> {
    let result;
    try {
      result = await this.client.latest({ base: 'EUR', symbols: [currency] });
    } catch (e) {
      if (e instanceof RatewiseUnavailableError) {
        const last = this.lastUsable.get(currency);
        if (last === undefined || last.fixedAt < this.now() - MAX_AGE_MS) return undefined;
        return { currency, mid: last.mid, estimated: true };
      }
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
    if (usable === undefined) return undefined;
    this.lastUsable.set(currency, { mid: usable.mid, fixedAt: Date.parse(usable.asOf) });
    return { currency, mid: usable.mid, estimated: false };
  }
}
