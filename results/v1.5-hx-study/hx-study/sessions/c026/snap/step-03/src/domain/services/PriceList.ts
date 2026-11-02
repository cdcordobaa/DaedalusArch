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
   * Euro price times the mid rate, rounded the way the currency is written (its decimals;
   * Swiss francs to 0.05), halves up, and never zero: at least the smallest showable amount.
   */
  convert(product: Product, currency: string, midRate: number, decimals: number): Price {
    const isChf = currency === 'CHF';
    const ticksPerUnit = isChf ? 20 : 10 ** decimals;
    const exact = (product.euroCents * midRate * ticksPerUnit) / 100;
    const ticks = Math.max(1, Math.round(Number(exact.toPrecision(12))));
    const shownDecimals = isChf ? Math.max(decimals, 2) : decimals;
    return { currency, amount: Number((ticks / ticksPerUnit).toFixed(shownDecimals)) };
  }
}
