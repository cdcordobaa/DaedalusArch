import type { ExchangeRate } from '../model/ExchangeRate';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Whether a rate may be used to price in `currency` at time `now`. */
export function isUsableRate(rate: ExchangeRate, currency: string, now: Date): boolean {
  if (rate.currency !== currency) return false;
  if (rate.indicative) return false;
  if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
  const fixedAt = Date.parse(rate.fixedAt);
  if (Number.isNaN(fixedAt)) return false;
  return now.getTime() - fixedAt <= MAX_AGE_MS;
}

/** Euro cents times mid rate, in units of 0.01, rounded to two decimals with halves up. */
export function convertCents(euroCents: number, mid: number): number {
  const cents = Number((euroCents * mid).toPrecision(12));
  return Math.round(cents) / 100;
}
