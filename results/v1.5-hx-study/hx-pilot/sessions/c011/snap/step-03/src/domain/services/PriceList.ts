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
   * Euro price times the mid rate, rounded to the currency's decimals with halves up
   * (Swiss francs to the nearest 0.05). Never zero: at least the smallest step.
   */
  convert(product: Product, currency: string, mid: number, decimals: number): Price {
    const places = currency === 'CHF' ? 2 : Number.isInteger(decimals) && decimals >= 0 && decimals <= 6 ? decimals : 2;
    const step = currency === 'CHF' ? 5 : 1; // in units of 10^-places
    const scale = 10 ** places;
    const steps = (product.euroCents * mid * scale) / 100 / step;
    const rounded = Math.max(1, Math.round(Number(steps.toPrecision(12))));
    return { currency, amount: Number(((rounded * step) / scale).toFixed(places)) };
  }
}
