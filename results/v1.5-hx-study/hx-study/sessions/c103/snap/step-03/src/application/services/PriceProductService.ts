import { PricingError } from '../../domain/errors/PricingError';
import { roundPrice } from '../../domain/services/PriceRounding';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import { RatesUnavailableError } from '../ports/out/ExchangeRates';
import type { EuroRate, ExchangeRates } from '../ports/out/ExchangeRates';

const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  private readonly lastUsable = new Map<string, EuroRate>();

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
      rate = await this.rates.latestFromEuro(currency);
      if (rate !== undefined && this.usable(rate, currency)) this.lastUsable.set(currency, rate);
      else rate = undefined;
    } catch (e) {
      if (!(e instanceof RatesUnavailableError)) throw e;
      const earlier = this.lastUsable.get(currency);
      if (earlier !== undefined && this.usable(earlier, currency)) {
        rate = earlier;
        estimated = true;
      }
    }
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    const amount = roundPrice((product.euroCents * rate.mid) / 100, currency, rate.decimals);
    return { sku: product.sku, name: product.name, currency, amount, estimated };
  }

  private usable(rate: EuroRate, currency: string): boolean {
    return (
      rate.currency === currency &&
      !rate.indicative &&
      Number.isFinite(rate.mid) &&
      rate.mid > 0 &&
      this.now().getTime() - rate.fixedAt.getTime() <= MAX_RATE_AGE_MS
    );
  }
}
