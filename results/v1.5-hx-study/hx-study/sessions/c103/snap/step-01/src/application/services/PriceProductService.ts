import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';

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
    const rate = await this.rates.latestFromEuro(currency);
    if (
      rate === undefined ||
      rate.currency !== currency ||
      rate.indicative ||
      !Number.isFinite(rate.mid) ||
      rate.mid <= 0 ||
      !(this.now().getTime() - rate.fixedAt.getTime() <= MAX_RATE_AGE_MS)
    ) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    const amount = Math.round(product.euroCents * rate.mid) / 100;
    return { sku: product.sku, name: product.name, currency, amount };
  }
}
