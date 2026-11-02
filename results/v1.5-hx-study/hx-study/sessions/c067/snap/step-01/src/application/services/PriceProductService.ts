import { PricingError } from '../../domain/errors/PricingError';
import { CurrencyConversion } from '../../domain/services/CurrencyConversion';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { EuroRates } from '../ports/out/EuroRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: EuroRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly conversion: CurrencyConversion = new CurrencyConversion(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
    }
    const rate = await this.rates.latestFromEuro(currency);
    if (rate === undefined || !this.conversion.isUsable(rate, currency, this.clock())) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE_REASON };
    }
    const price = this.conversion.convert(product.euroCents, rate);
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
  }
}
