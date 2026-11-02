import type { ExchangeRate } from '../../domain/model/ExchangeRate';
import { PricingError } from '../../domain/errors/PricingError';
import { PriceConverter } from '../../domain/services/PriceConverter';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  private readonly lastUsable = new Map<string, ExchangeRate>();

  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly converter: PriceConverter = new PriceConverter(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const now = this.now();
    const answer = await this.rates.latestFromEur(currency);
    let rate: ExchangeRate | undefined;
    let estimated = false;
    if (answer === null) {
      const last = this.lastUsable.get(currency);
      if (last !== undefined && this.converter.isUsable(last, currency, now)) {
        rate = last;
        estimated = true;
      }
    } else {
      rate = answer.find((r) => this.converter.isUsable(r, currency, now));
      if (rate !== undefined) this.lastUsable.set(currency, rate);
    }
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, estimated: false, reason: UNAVAILABLE_REASON };
    }
    const price = this.converter.convert(product, rate);
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated };
  }
}
