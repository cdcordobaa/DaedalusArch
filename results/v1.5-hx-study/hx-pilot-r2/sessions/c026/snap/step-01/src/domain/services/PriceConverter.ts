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

  /** Euro price times the mid rate, rounded to two decimals, halves up. */
  convert(product: Product, rate: ExchangeRate): Price {
    // Work in cents; toPrecision strips binary floating-point noise before rounding.
    const cents = Math.round(Number((product.euroCents * rate.mid).toPrecision(12)));
    return { currency: rate.currency, amount: cents / 100 };
  }
}
