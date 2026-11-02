import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

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
      return {
        sku: product.sku,
        name: product.name,
        currency: price.currency,
        amount: price.amount,
        estimated: false,
      };
    }
    const rate = await this.rates.euroTo(currency);
    if (rate === undefined) {
      return {
        sku: product.sku,
        name: product.name,
        currency,
        amount: null,
        estimated: false,
        reason: 'Prices in this currency are not available right now.',
      };
    }
    const price = this.prices.convert(product, currency, rate.mid);
    return {
      sku: product.sku,
      name: product.name,
      currency: price.currency,
      amount: price.amount,
      estimated: rate.estimated,
    };
  }
}
