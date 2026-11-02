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
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount };
    }
    const rate = await this.rates.fromEuro(currency);
    if (rate === null || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON };
    }
    // euro cents * rate = amount in hundredths; halves round up (toPrecision trims float noise).
    const hundredths = Math.round(Number((product.euroCents * rate.mid).toPrecision(12)));
    return { sku: product.sku, name: product.name, currency, amount: hundredths / 100 };
  }
}
