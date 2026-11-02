import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates, RateQuote } from '../ports/out/ExchangeRates';

export const PRICES_UNAVAILABLE = 'Prices in this currency are not available right now.';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class PriceProductService implements PriceProduct {
  /** Last usable rate per currency, as given by the rate source. */
  private readonly lastRates = new Map<string, RateQuote>();

  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return {
        sku: product.sku,
        name: product.name,
        currency: price.currency,
        amount: price.amount,
        estimated: false,
      };
    }
    const answer = await this.rates.euroMidRate(currency);
    let quote: RateQuote | undefined;
    let estimated = false;
    if (answer === 'unavailable') {
      const last = this.lastRates.get(currency);
      if (last !== undefined && this.now().getTime() - last.fixedAt.getTime() <= MAX_AGE_MS) {
        quote = last;
        estimated = true;
      }
    } else if (answer !== undefined) {
      quote = answer;
      this.lastRates.set(currency, answer);
    }
    if (quote === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: PRICES_UNAVAILABLE };
    }
    // Round to two decimals, halves up; toPrecision trims binary float noise first.
    const scaled = Number((product.euroCents * quote.mid).toPrecision(12));
    const amount = Math.round(scaled) / 100;
    return { sku: product.sku, name: product.name, currency, amount, estimated };
  }
}
