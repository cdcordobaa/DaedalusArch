import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import { ExchangeRatesUnavailableError } from '../ports/out/ExchangeRates';
import type { ExchangeRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';
const SCALE = BigInt(1000000000000);

export class PriceProductService implements PriceProduct {
  /** Last usable (firm, in-date when received) rate per currency. */
  private readonly lastRates = new Map<string, ExchangeRate>();

  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    let rate: ExchangeRate | undefined;
    let estimated = false;
    try {
      const candidates = await this.rates.latestFromEur(currency);
      rate = candidates.find((r) => this.usable(r, currency));
      if (rate !== undefined) this.lastRates.set(currency, rate);
    } catch (e) {
      if (!(e instanceof ExchangeRatesUnavailableError)) throw e;
      const last = this.lastRates.get(currency);
      if (last !== undefined && this.usable(last, currency)) {
        rate = last;
        estimated = true;
      }
    }
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, estimated: false, reason: UNAVAILABLE };
    }
    // Exact round-half-up on scaled integers, in steps of the currency's smallest shown amount.
    const d = Number.isInteger(rate.decimals) && rate.decimals >= 0 && rate.decimals <= 6 ? rate.decimals : 2;
    const unit = BigInt(10) ** BigInt(d); // minor units per major unit
    const step = currency === 'CHF' ? BigInt(5) * BigInt(10) ** BigInt(Math.max(d - 2, 0)) : BigInt(1);
    const mid = BigInt(rate.mid.toFixed(12).replace('.', ''));
    // value in minor units = euroCents * mid / 100 * unit
    const numerator = BigInt(product.euroCents) * mid * unit;
    const denominator = SCALE * BigInt(100) * step;
    let steps = (BigInt(2) * numerator + denominator) / (BigInt(2) * denominator);
    if (steps < BigInt(1)) steps = BigInt(1);
    return { sku: product.sku, name: product.name, currency, amount: Number(steps * step) / Number(unit), estimated };
  }

  private usable(rate: ExchangeRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0 || rate.mid >= 1e6) return false;
    const t = rate.fixedAt.getTime();
    if (Number.isNaN(t)) return false;
    return this.now().getTime() - t <= MAX_RATE_AGE_MS;
  }
}
