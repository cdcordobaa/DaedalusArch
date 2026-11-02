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

  /** Euro price times the mid rate, to two decimals, halves rounded up (exact decimal arithmetic). */
  convert(product: Product, currency: string, rate: number): Price {
    const scaled = BigInt(rate.toFixed(12).replace('.', ''));
    const unit = 10n ** 12n;
    const cents = (BigInt(product.euroCents) * scaled + unit / 2n) / unit;
    return { currency, amount: Number(cents) / 100 };
  }
}
