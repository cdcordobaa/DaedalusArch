import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import { RatesUnavailableError } from '../ports/out/ExchangeRates';
import type { EuroRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';
const SCALE = 10;

/**
 * euroCents * mid, rounded half up to a multiple of `step` units of 10^-decimals,
 * never below one step (exact decimal arithmetic).
 */
function convert(euroCents: number, mid: number, decimals: number, step: number): number {
  const scaled = BigInt(mid.toFixed(SCALE).replace('.', ''));
  const unit = 10n ** BigInt(SCALE);
  const denominator = 100n * unit * BigInt(step);
  const numerator = BigInt(euroCents) * scaled * 10n ** BigInt(decimals);
  let steps = (numerator * 2n + denominator) / (denominator * 2n);
  if (steps < 1n) steps = 1n;
  return Number(steps * BigInt(step)) / 10 ** decimals;
}

export class PriceProductService implements PriceProduct {
  private readonly lastGood = new Map<string, EuroRate>();

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
    let rate: EuroRate | undefined;
    let estimated = false;
    try {
      rate = await this.rates.latestFromEur(currency);
      if (rate !== undefined && this.usable(rate, currency)) this.lastGood.set(currency, rate);
    } catch (e) {
      if (!(e instanceof RatesUnavailableError)) throw e;
      const earlier = this.lastGood.get(currency);
      rate = earlier !== undefined && this.usable(earlier, currency) ? earlier : undefined;
      estimated = true;
    }
    if (rate === undefined || !this.usable(rate, currency)) {
      return { sku: product.sku, name: product.name, currency, amount: null, estimated: false, reason: UNAVAILABLE };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: this.convert(product.euroCents, rate),
      estimated,
    };
  }

  private convert(euroCents: number, rate: EuroRate): number {
    if (rate.currency === 'CHF') return convert(euroCents, rate.mid, 2, 5);
    return convert(euroCents, rate.mid, rate.minorUnits, 1);
  }

  private usable(rate: EuroRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    if (!Number.isInteger(rate.minorUnits) || rate.minorUnits < 0 || rate.minorUnits > 8) return false;
    const fixedAt = rate.asOf.getTime();
    if (Number.isNaN(fixedAt)) return false;
    return this.now().getTime() - fixedAt <= MAX_RATE_AGE_MS;
  }
}
