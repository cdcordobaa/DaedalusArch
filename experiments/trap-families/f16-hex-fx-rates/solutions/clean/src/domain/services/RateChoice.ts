import type { ExchangeRate } from '../model/ExchangeRate';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Which rate prices may be shown at: a firm rate fixed no more than 24 hours ago. Remembers the last such rate per
 * currency, for when rates cannot be fetched.
 */
export class RateChoice {
  private readonly last = new Map<string, ExchangeRate>();

  /** The fetched rate if it may be used (and is then remembered), else undefined. */
  fetched(rate: ExchangeRate | undefined, now: Date): ExchangeRate | undefined {
    if (rate === undefined || !this.usable(rate, now)) return undefined;
    this.last.set(rate.currency, rate);
    return rate;
  }

  /** The last remembered rate for the currency if it may still be used, else undefined. */
  fallback(currency: string, now: Date): ExchangeRate | undefined {
    const rate = this.last.get(currency);
    return rate !== undefined && this.usable(rate, now) ? rate : undefined;
  }

  private usable(rate: ExchangeRate, now: Date): boolean {
    return !rate.indicative && now.getTime() - rate.fixedAt.getTime() <= MAX_AGE_MS;
  }
}
