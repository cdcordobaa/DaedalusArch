import type { ExchangeRate } from '../model/ExchangeRate';
import type { Price } from '../model/Price';
import type { Product } from '../model/Product';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;

/** Decides which rates may be used and converts our euro prices with them. */
export class PriceConverter {
  isUsable(rate: ExchangeRate, currency: string, now: Date): boolean {
    if (rate.indicative) return false;
    if (rate.base !== 'EUR' || rate.currency !== currency) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    const fixedAt = rate.fixedAt.getTime();
    if (Number.isNaN(fixedAt)) return false;
    return now.getTime() - fixedAt <= MAX_RATE_AGE_MS;
  }

  /**
   * Euro price times the mid rate, rounded to the currency's decimals (CHF: nearest 0.05),
   * halves up, and never below the smallest shown amount.
   */
  convert(product: Product, rate: ExchangeRate): Price {
    const decimals = Number.isInteger(rate.decimals) && rate.decimals >= 0 ? rate.decimals : 2;
    const chf = rate.currency === 'CHF';
    // Count of smallest steps: 0.05 for CHF, otherwise one minor unit.
    const stepsPerUnit = chf ? 20 : 10 ** decimals;
    const shownDecimals = chf ? Math.max(decimals, 2) : decimals;
    const exact = (product.euroCents / 100) * rate.mid * stepsPerUnit;
    // toPrecision strips binary floating-point noise before rounding.
    const steps = Math.max(1, Math.round(Number(exact.toPrecision(12))));
    return { currency: rate.currency, amount: Number((steps / stepsPerUnit).toFixed(shownDecimals)) };
  }
}
