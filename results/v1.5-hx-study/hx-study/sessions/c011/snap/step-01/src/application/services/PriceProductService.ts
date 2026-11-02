import { PricingError } from '../../domain/errors/PricingError';
import { convertCents, isUsableRate } from '../../domain/services/Conversion';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const RATES_UNAVAILABLE = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
    }
    const rate = await this.rates.latestFromEur(currency);
    if (rate === undefined || !isUsableRate(rate, currency, this.now())) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: RATES_UNAVAILABLE };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: convertCents(product.euroCents, rate.mid),
    };
  }
}
