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
    const euro = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    const rate = await this.rates.euroTo(currency);
    if (rate === undefined || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE_REASON };
    }
    // euroCents * mid is the amount in hundredths; round half up to whole hundredths.
    const hundredths = Math.floor(Number((product.euroCents * rate.mid).toPrecision(12)) + 0.5);
    return { sku: product.sku, name: product.name, currency, amount: hundredths / 100, estimated: rate.estimated === true };
  }
}
