import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import { ExchangeRatesUnavailableError, type ExchangeRate, type ExchangeRates } from '../ports/out/ExchangeRates';

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
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    let rate: ExchangeRate | undefined;
    let estimated = false;
    try {
      rate = await this.rates.latestFromEur(currency);
      if (rate !== undefined && this.usable(rate, currency)) this.lastUsable.set(currency, rate);
    } catch (e) {
      if (!(e instanceof ExchangeRatesUnavailableError)) throw e;
      rate = this.lastUsable.get(currency);
      estimated = true;
    }
    if (rate === undefined || !this.usable(rate, currency)) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    // Round half up to two decimals; toPrecision strips binary float noise first.
    const scaled = Number((euro.amount * rate.mid * 100).toPrecision(12));
    const amount = Math.round(scaled) / 100;
    return { sku: product.sku, name: product.name, currency, amount, estimated };
  }

  private readonly lastUsable = new Map<string, ExchangeRate>();

  private usable(rate: ExchangeRate, currency: string): boolean {
    if (rate.currency !== currency || rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    const fixedAt = rate.fixedAt.getTime();
    if (Number.isNaN(fixedAt)) return false;
    return this.now().getTime() - fixedAt <= MAX_RATE_AGE_MS;
  }
}
