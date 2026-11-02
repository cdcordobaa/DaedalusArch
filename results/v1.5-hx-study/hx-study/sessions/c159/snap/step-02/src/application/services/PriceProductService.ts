import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRate, ExchangeRates } from '../ports/out/ExchangeRates';

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
    const rates = await this.rates.latestFromEur(currency);
    const usable = (r: ExchangeRate): boolean =>
      r.currency === currency &&
      !r.indicative &&
      Number.isFinite(r.mid) &&
      r.mid > 0 &&
      Number.isFinite(r.asOf.getTime()) &&
      nowMs - r.asOf.getTime() <= MAX_RATE_AGE_MS;
    let rate = (rates ?? []).find(usable);
    let estimated = false;
    if (rate !== undefined) {
      this.lastUsable.set(currency, rate);
    } else if (rates === null) {
      const earlier = this.lastUsable.get(currency);
      if (earlier !== undefined && usable(earlier)) {
        rate = earlier;
        estimated = true;
      }
    }
    if (rate === undefined) {
      return {
        sku: product.sku,
        name: product.name,
        currency,
        amount: null,
        reason: UNAVAILABLE_REASON,
        estimated: false,
      };
    }
    // cents * mid = converted amount in hundredths; round halves up, trimming float noise first.
    const hundredths = Number((product.euroCents * rate.mid).toPrecision(12));
    const amount = Math.round(hundredths) / 100;
    return { sku: product.sku, name: product.name, currency, amount, estimated };
  }
}
