import type { ExchangeRate } from '../model/ExchangeRate';
import type { Price } from '../model/Price';
import type { Product } from '../model/Product';

/** Steps per whole unit for currencies whose prices are not rounded to their decimals. */
const STEPS_PER_UNIT: Readonly<Record<string, number>> = { CHF: 20 };

/** A euro price in another currency, rounded the way that currency is written and never shown as zero. */
export class CurrencyConversion {
  convert(product: Product, rate: ExchangeRate): Price {
    const exact = (product.euroCents * rate.perEuro) / 100;
    const perUnit = STEPS_PER_UNIT[rate.currency] ?? 10 ** rate.decimals;
    const steps = Math.max(1, Math.floor(exact * perUnit + 0.5 + 1e-9));
    return { currency: rate.currency, amount: steps / perUnit };
  }
}
