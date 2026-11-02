import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { EuroRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

/** Decimal string of a finite positive number, never in exponent form. */
function plainDecimal(n: number): string {
  const s = String(n);
  return /e/i.test(s) ? n.toFixed(20) : s;
}

/** Round half up (values are positive) euroCents * mid to whole hundredths, exactly, and return it as an amount. */
function convert(euroCents: number, mid: number): number {
  const [int, frac = ''] = plainDecimal(mid).split('.');
  const scale = 10n ** BigInt(frac.length);
  const scaledMid = BigInt(int + frac);
  const product = BigInt(euroCents) * scaledMid;
  const cents = (product * 2n + scale) / (2n * scale);
  return Number(cents) / 100;
}

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Newest usable rate Ratewise gave us, per currency. */
  private readonly lastRates = new Map<string, EuroRate>();

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }

    const nowMs = this.now().getTime();
    const answer = await this.rates.latestFromEuro(currency);
    const usable = (answer ?? [])
      .filter(
        (r) =>
          r.currency === currency &&
          !r.indicative &&
          Number.isFinite(r.mid) &&
          r.mid > 0 &&
          Number.isFinite(r.asOf.getTime()) &&
          nowMs - r.asOf.getTime() <= MAX_RATE_AGE_MS,
      )
      .sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
    let rate = usable[0];
    let estimated = false;
    if (answer === null) {
      const last = this.lastRates.get(currency);
      if (last !== undefined && nowMs - last.asOf.getTime() <= MAX_RATE_AGE_MS) {
        rate = last;
        estimated = true;
      }
    } else if (rate !== undefined) {
      const last = this.lastRates.get(currency);
      if (last === undefined || rate.asOf.getTime() >= last.asOf.getTime()) this.lastRates.set(currency, rate);
    }
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON, estimated: false };
    }
    return { sku: product.sku, name: product.name, currency, amount: convert(product.euroCents, rate.mid), estimated };
  }
}
