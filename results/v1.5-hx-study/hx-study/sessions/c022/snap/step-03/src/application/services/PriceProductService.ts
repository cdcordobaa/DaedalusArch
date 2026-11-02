import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates, UsableRate } from '../ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class PriceProductService implements PriceProduct {
  private readonly lastUsable = new Map<string, UsableRate>();

  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency !== 'EUR') {
      const answer = await this.rates.eurTo(currency);
      let mid: number | null = null;
      let decimals = 2;
      let estimated = false;
      if (answer.unavailable) {
        const last = this.lastUsable.get(currency);
        if (last && this.now() - last.asOf <= MAX_AGE_MS) {
          mid = last.mid;
          decimals = last.decimals;
          estimated = true;
        }
      } else if (answer.rate) {
        mid = answer.rate.mid;
        decimals = answer.rate.decimals;
        this.lastUsable.set(currency, answer.rate);
      }
      if (mid === null) {
        return {
          sku: product.sku,
          name: product.name,
          currency,
          amount: null,
          reason: 'Prices in this currency are not available right now.',
        };
      }
      // euroCents * mid is in hundredths of the target currency.
      // Work in whole steps of the smallest shown amount: 0.05 for CHF, else 10^-decimals.
      const stepsPerUnit = currency === 'CHF' ? 20 : 10 ** decimals;
      const exact = Number(((product.euroCents * mid * stepsPerUnit) / 100).toPrecision(12));
      const steps = Math.max(1, Math.floor(exact + 0.5));
      return { sku: product.sku, name: product.name, currency, amount: steps / stepsPerUnit, estimated };
    }
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
  }
}
