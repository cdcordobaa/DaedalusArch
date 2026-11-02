import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';

export class PriceProductService implements PriceProduct {
  constructor(private readonly prices: PriceList = new PriceList()) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency !== 'EUR') throw new PricingError('prices are only available in EUR');
    const price = this.prices.euroPrice(product);
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
  }
}
