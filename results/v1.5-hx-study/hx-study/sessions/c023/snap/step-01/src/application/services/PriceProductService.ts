import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const base = { sku: product.sku, name: product.name, currency };
    if (currency === 'EUR') {
      return { ...base, amount: this.prices.euroPrice(product).amount };
    }
    const rate = await this.rates.latestFromEuro(currency);
    if (
      rate === null ||
      rate.currency !== currency ||
      !Number.isFinite(rate.mid) ||
      rate.mid <= 0 ||
      this.now().getTime() - rate.fixedAt.getTime() > MAX_RATE_AGE_MS
    ) {
      return { ...base, amount: null, reason: UNAVAILABLE_REASON };
    }
    // euro cents * mid = hundredths of the shopper's currency; halves round up.
    const hundredths = Math.floor(Number((product.euroCents * rate.mid).toPrecision(12)) + 0.5);
    return { ...base, amount: hundredths / 100 };
  }
}
