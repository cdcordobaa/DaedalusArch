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
    // euro cents * mid = hundredths of the target currency; round halves up.
    const hundredths = Number((product.euroCents * rate.mid).toPrecision(12));
    return { currency: rate.currency, amount: Math.floor(hundredths + 0.5) / 100 };
  }
}
