import { PricingError } from '../../domain/errors/PricingError';
import type { ExchangeRate } from '../../domain/model/ExchangeRate';
import { PriceList } from '../../domain/services/PriceList';
import { roundPrice } from '../../domain/services/PriceRounding';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  private readonly lastUsable = new Map<string, ExchangeRate>();

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
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    const nowMs = this.now().getTime();
    const answer = await this.rates.latestFromEuro(currency);
    let usable = answer?.find((r) => this.isUsable(r, currency, nowMs));
    let estimated = false;
    if (answer === null) {
      const last = this.lastUsable.get(currency);
      if (last !== undefined && this.isUsable(last, currency, nowMs)) {
        usable = last;
        estimated = true;
      }
    } else if (usable !== undefined) {
      this.lastUsable.set(currency, usable);
    }
    if (usable === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, estimated: false, reason: UNAVAILABLE_REASON };
    }
    const amount = roundPrice(euro.amount * usable.mid, currency, usable.decimals);
    return { sku: product.sku, name: product.name, currency, amount, estimated };
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
