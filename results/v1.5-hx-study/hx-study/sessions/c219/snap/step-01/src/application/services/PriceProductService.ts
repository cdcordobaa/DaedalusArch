import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const UNAVAILABLE = 'Prices in this currency are not available right now.';

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
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
    }
    const rate = await this.rates.fromEuro(currency);
    if (rate === undefined || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    return { sku: product.sku, name: product.name, currency, amount: convert(product.euroCents, rate.mid) };
  }
}

/** euroCents * mid / 100, rounded to two decimals with halves up, using exact integer arithmetic. */
function convert(euroCents: number, mid: number): number {
  const scale = 10n ** 10n;
  const midScaled = BigInt(mid.toFixed(10).replace('.', ''));
  const num = BigInt(euroCents) * midScaled; // result in cents, scaled by 1e10
  const cents = (2n * num + scale) / (2n * scale);
  return Number(cents) / 100;
}
