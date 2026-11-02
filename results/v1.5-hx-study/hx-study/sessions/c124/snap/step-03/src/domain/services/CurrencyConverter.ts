import type { ExchangeRate } from '../model/ExchangeRate';
import type { Price } from '../model/Price';
import type { Product } from '../model/Product';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Converts our euro prices with a rate we are allowed to use. */
export class CurrencyConverter {
  /** A rate is usable when it is for the asked currency, not indicative and fixed at most 24 hours ago. */
  isUsable(rate: ExchangeRate, currency: string, now: Date): boolean {
    const fixed = rate.fixedAt.getTime();
    return (
      rate.currency === currency &&
      !rate.indicative &&
      Number.isFinite(rate.mid) &&
      rate.mid > 0 &&
      Number.isFinite(fixed) &&
      now.getTime() - fixed <= MAX_AGE_MS
    );
  }

  convert(product: Product, rate: ExchangeRate): Price {
    // euro cents * mid = hundredths of the target currency.
    const hundredths = product.euroCents * rate.mid;
    if (rate.currency === 'CHF') {
      // Nearest 0.05 (five hundredths), halves up, never zero.
      const steps = Math.max(1, Math.floor(Number((hundredths / 5).toPrecision(12)) + 0.5));
      return { currency: rate.currency, amount: (steps * 5) / 100 };
    }
    const decimals = Number.isInteger(rate.decimals) && rate.decimals >= 0 ? rate.decimals : 2;
    const scale = 10 ** decimals;
    const units = Number(((hundredths * scale) / 100).toPrecision(12));
    const minor = Math.max(1, Math.floor(units + 0.5));
    return { currency: rate.currency, amount: minor / scale };
  }
}
