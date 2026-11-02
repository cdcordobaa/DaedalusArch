import { PricingError } from '../errors/PricingError';
import type { Price } from '../model/Price';
import type { Product } from '../model/Product';

const PRODUCTS: readonly Product[] = [
  { sku: 'MUG-01', name: 'Enamel mug', euroCents: 1290 },
  { sku: 'TEE-02', name: 'Organic T-shirt', euroCents: 2450 },
  { sku: 'STK-03', name: 'Sticker', euroCents: 2 },
];

/** Our own euro prices. */
export class PriceList {
  product(sku: string): Product {
    const p = PRODUCTS.find((x) => x.sku === sku);
    if (p === undefined) throw new PricingError(`unknown product ${sku}`);
    return p;
  }

  euroPrice(product: Product): Price {
    return { currency: 'EUR', amount: product.euroCents / 100 };
  }

  /**
   * Euro price times the mid rate, rounded to the currency's decimals (CHF: nearest 0.05),
   * halves rounded up (exact decimal arithmetic). Never zero: at least the smallest step.
   */
  convert(product: Product, currency: string, rate: number, decimals: number): Price {
    const scaled = BigInt(rate.toFixed(12).replace('.', ''));
    const denominator = 10n ** 12n * 100n;
    const stepsPerUnit = currency === 'CHF' ? 20n : 10n ** BigInt(decimals);
    const numerator = BigInt(product.euroCents) * scaled * stepsPerUnit;
    let steps = (2n * numerator + denominator) / (2n * denominator);
    if (steps < 1n) steps = 1n;
    return { currency, amount: Number(steps) / Number(stepsPerUnit) };
  }
}
