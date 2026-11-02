import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';
const SCALE = BigInt(1000000000000);
const HALF = SCALE / BigInt(2);

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
    const candidates = await this.rates.latestFromEur(currency);
    const rate = candidates.find((r) => this.usable(r, currency));
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    // cents = round-half-up(euroCents * mid), computed exactly on a scaled integer.
    const mid = BigInt(rate.mid.toFixed(12).replace('.', ''));
    const cents = (BigInt(product.euroCents) * mid + HALF) / SCALE;
    return { sku: product.sku, name: product.name, currency, amount: Number(cents) / 100 };
  }

  private usable(rate: ExchangeRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0 || rate.mid >= 1e6) return false;
    const t = rate.fixedAt.getTime();
    if (Number.isNaN(t)) return false;
    return this.now().getTime() - t <= MAX_RATE_AGE_MS;
  }
}
