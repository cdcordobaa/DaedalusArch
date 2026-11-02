import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const UNAVAILABLE = 'Prices in this currency are not available right now.';
const DIGITS = 10;

/** euroCents * mid in cents, rounded half up, computed exactly on the decimal rate. */
function convertCents(euroCents: number, mid: number): number {
  const scale = 10n ** BigInt(DIGITS);
  const scaledMid = BigInt(mid.toFixed(DIGITS).replace('.', ''));
  return Number((BigInt(euroCents) * scaledMid + scale / 2n) / scale);
}

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.euroTo(currency);
    if (rate === null || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: convertCents(product.euroCents, rate.mid) / 100,
      estimated: rate.estimated === true,
    };
  }
}
