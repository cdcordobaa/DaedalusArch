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

/**
 * Euro cents converted at the mid rate and rounded the way the currency is written:
 * to its decimals (Swiss francs: to 0.05), halves up, never below the smallest shown amount.
 */
export function convertCents(euroCents: number, rate: ExchangeRate): number {
  const decimals = Number.isInteger(rate.decimals) && rate.decimals >= 0 ? rate.decimals : 2;
  const swiss = rate.currency === 'CHF';
  // Amount expressed in smallest shown units: 0.05 francs, or 10^-decimals.
  const exact = swiss ? (euroCents * rate.mid) / 5 : (euroCents * rate.mid * 10 ** decimals) / 100;
  const units = Math.max(1, Math.round(Number(exact.toPrecision(12))));
  return swiss ? (units * 5) / 100 : units / 10 ** decimals;
}
