import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates, UsableRate } from '../ports/out/ExchangeRates';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  private readonly lastRates = new Map<string, UsableRate>();

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const found = await this.rates.fromEuro(currency);
    let rate: UsableRate | undefined;
    let estimated = false;
    if (found === 'unavailable') {
      const last = this.lastRates.get(currency);
      if (last !== undefined && this.now() - last.asOf <= MAX_AGE_MS) {
        rate = last;
        estimated = true;
      }
    } else if (found !== undefined && found.currency === currency) {
      rate = found;
      this.lastRates.set(currency, found);
    }
    if (rate === undefined || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    return { sku: product.sku, name: product.name, currency, amount: convert(product.euroCents, rate.mid, currency, rate.minorUnits), estimated };
  }
}

/**
 * euroCents * mid / 100 rounded to the currency's step with halves up, using exact integer arithmetic.
 * The step is 10^-minorUnits (0.05 for CHF); a result is never zero, it is at least one step.
 */
function convert(euroCents: number, mid: number, currency: string, minorUnits: number): number {
  const scale = 10n ** 12n; // value = num / scale
  const midScaled = BigInt(mid.toFixed(10).replace('.', ''));
  const num = BigInt(euroCents) * midScaled;
  const stepN = currency === 'CHF' ? 5n : 1n;
  const stepD = currency === 'CHF' ? 100n : 10n ** BigInt(minorUnits);
  // units = round(value / (stepN / stepD)) = round(num * stepD / (scale * stepN))
  const den = scale * stepN;
  let units = (2n * num * stepD + den) / (2n * den);
  if (units < 1n) units = 1n;
  return Number(units * stepN) / Number(stepD);
}
