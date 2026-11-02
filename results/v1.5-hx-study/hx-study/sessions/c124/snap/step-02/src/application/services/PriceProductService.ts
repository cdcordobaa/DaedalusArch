import { PricingError } from '../../domain/errors/PricingError';
import { CurrencyConverter } from '../../domain/services/CurrencyConverter';
import { PriceList } from '../../domain/services/PriceList';
import type { ExchangeRate } from '../../domain/model/ExchangeRate';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import { ExchangeRatesUnavailableError, type ExchangeRates } from '../ports/out/ExchangeRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  /** Last usable (firm, fresh) rate Ratewise gave us, per currency. */
  private readonly lastUsable = new Map<string, ExchangeRate>();

  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly converter: CurrencyConverter = new CurrencyConverter(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return {
        sku: product.sku,
        name: product.name,
        currency: price.currency,
        amount: price.amount,
        estimated: false,
      };
    }
    const now = this.clock();
    let rate: ExchangeRate | undefined;
    let estimated = false;
    try {
      rate = (await this.rates.latestFromEuro(currency)).find((r) =>
        this.converter.isUsable(r, currency, now),
      );
      if (rate !== undefined) this.lastUsable.set(currency, rate);
    } catch (e) {
      if (!(e instanceof ExchangeRatesUnavailableError)) throw e;
      const earlier = this.lastUsable.get(currency);
      if (earlier !== undefined && this.converter.isUsable(earlier, currency, now)) {
        rate = earlier;
        estimated = true;
      }
    }
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE_REASON };
    }
    const price = this.converter.convert(product, rate);
    return {
      sku: product.sku,
      name: product.name,
      currency: price.currency,
      amount: price.amount,
      estimated,
    };
  }
}
