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
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.eurTo(currency);
    if (rate === null) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON };
    }
    // Units per major unit: Swiss francs round to 0.05 (20 per franc), others to Ratewise's decimals.
    const perMajor = currency === 'CHF' ? 20 : 10 ** rate.minorUnits;
    // Round half up; toPrecision trims binary float noise. Never show zero: minimum is one unit.
    const raw = Number(((product.euroCents / 100) * rate.mid * perMajor).toPrecision(12));
    const units = Math.max(1, Math.round(raw));
    return { sku: product.sku, name: product.name, currency, amount: units / perMajor, estimated: rate.estimated };
  }
}
