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
    const latest = await this.rates.latestFromEuro(currency);
    const nowMs = this.now().getTime();
    const rate = latest?.find((r) => {
      const age = nowMs - r.fixedAt.getTime();
      return r.currency === currency && !r.indicative && Number.isFinite(r.mid) && age <= MAX_RATE_AGE_MS;
    });
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    const price = this.prices.convert(product, currency, rate.mid);
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
  }
}
