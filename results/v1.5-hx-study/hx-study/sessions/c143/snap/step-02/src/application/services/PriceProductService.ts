import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.eurTo(currency);
    if (rate === null) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON };
    }
    // Round half up to two decimals; toPrecision trims binary float noise before rounding.
    const cents = Math.round(Number((product.euroCents * rate.mid).toPrecision(12)));
    return { sku: product.sku, name: product.name, currency, amount: cents / 100, estimated: rate.estimated };
  }
}
