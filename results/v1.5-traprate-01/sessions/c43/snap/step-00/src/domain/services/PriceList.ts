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
}
