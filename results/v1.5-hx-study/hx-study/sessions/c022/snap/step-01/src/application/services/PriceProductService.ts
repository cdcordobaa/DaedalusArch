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
    const price = this.prices.euroPrice(product);
    if (currency !== 'EUR') {
      const mid = await this.rates.eurTo(currency);
      if (mid === null) {
        return {
          sku: product.sku,
          name: product.name,
          currency,
          amount: null,
          reason: 'Prices in this currency are not available right now.',
        };
      }
      // euroCents * mid is in hundredths of the target currency; round halves up.
      const hundredths = Math.floor(Number((product.euroCents * mid).toPrecision(12)) + 0.5);
      return { sku: product.sku, name: product.name, currency, amount: hundredths / 100 };
    }
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
  }
}
