import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { EuroRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';
const SCALE = 10;

/** euroCents * mid, in cents, rounded to the nearest cent with halves up (exact decimal arithmetic). */
function convertCents(euroCents: number, mid: number): number {
  const scaled = BigInt(mid.toFixed(SCALE).replace('.', ''));
  const unit = 10n ** BigInt(SCALE);
  const numerator = BigInt(euroCents) * scaled;
  return Number((numerator * 2n + unit) / (unit * 2n));
}

export class PriceProductService implements PriceProduct {
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
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount };
    }
    const rate = await this.rates.latestFromEur(currency);
    if (rate === undefined || !this.usable(rate, currency)) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: convertCents(product.euroCents, rate.mid) / 100,
    };
  }

  private usable(rate: EuroRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    const fixedAt = rate.asOf.getTime();
    if (Number.isNaN(fixedAt)) return false;
    return this.now().getTime() - fixedAt <= MAX_RATE_AGE_MS;
  }
}
