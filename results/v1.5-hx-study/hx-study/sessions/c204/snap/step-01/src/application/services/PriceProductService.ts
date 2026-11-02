import { PricingError } from '../../domain/errors/PricingError';
import type { ExchangeRate } from '../../domain/model/ExchangeRate';
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
    const euro = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount };
    }
    const nowMs = this.now().getTime();
    const usable = (await this.rates.latestFromEuro(currency)).find((r) => this.isUsable(r, currency, nowMs));
    if (usable === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON };
    }
    // Round to two decimals, halves up; toPrecision strips binary floating-point noise first.
    const cents = Math.round(Number((euro.amount * usable.mid * 100).toPrecision(12)));
    return { sku: product.sku, name: product.name, currency, amount: cents / 100 };
  }

  private isUsable(rate: ExchangeRate, currency: string, nowMs: number): boolean {
    const asOfMs = rate.fixedAt.getTime();
    return (
      rate.currency === currency &&
      !rate.indicative &&
      Number.isFinite(rate.mid) &&
      rate.mid > 0 &&
      Number.isFinite(asOfMs) &&
      nowMs - asOfMs <= MAX_RATE_AGE_MS
    );
  }
}
