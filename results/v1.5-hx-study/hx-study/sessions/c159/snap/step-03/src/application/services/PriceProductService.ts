import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

/**
 * Rounds a converted amount given in hundredths (cents * mid) the way the currency is written:
 * Ratewise's decimals (CHF: nearest 0.05), halves up, never below the smallest shown amount.
 */
function roundForCurrency(hundredths: number, currency: string, minorUnits: number): number {
  const decimals = Number.isInteger(minorUnits) && minorUnits >= 0 ? minorUnits : 2;
  // Express the amount in units of the smallest step, trimming float noise before rounding.
  const stepsPerUnit = currency === 'CHF' ? 20 : 10 ** decimals;
  const exact = Number(((hundredths / 100) * stepsPerUnit).toPrecision(12));
  const steps = Math.max(1, Math.floor(exact + 0.5));
  return steps / stepsPerUnit;
}

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
    const amount = roundForCurrency(product.euroCents * rate.mid, currency, rate.minorUnits);
    return { sku: product.sku, name: product.name, currency, amount, estimated };
  }
}
