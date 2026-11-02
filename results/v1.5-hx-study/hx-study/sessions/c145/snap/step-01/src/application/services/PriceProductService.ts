import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const PRICES_UNAVAILABLE = 'Prices in this currency are not available right now.';

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
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
    }
    const rate = await this.rates.euroMidRate(currency);
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: PRICES_UNAVAILABLE };
    }
    // Round to two decimals, halves up; toPrecision trims binary float noise first.
    const scaled = Number((product.euroCents * rate).toPrecision(12));
    const amount = Math.round(scaled) / 100;
    return { sku: product.sku, name: product.name, currency, amount };
  }
}
