import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
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
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount };
    }
    const found = await this.rates.latestFromEur(currency);
    const rate = found?.find((r) => this.usable(r, currency));
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    // Round half up to two decimals; toPrecision strips binary floating-point noise.
    const cents = Math.round(Number((product.euroCents * rate.mid).toPrecision(12)));
    return { sku: product.sku, name: product.name, currency, amount: cents / 100 };
  }

  private usable(rate: ExchangeRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    const fixedAt = rate.fixedAt.getTime();
    if (Number.isNaN(fixedAt)) return false;
    return this.now().getTime() - fixedAt <= MAX_RATE_AGE_MS;
  }
}
