import { PricingError } from '../../domain/errors/PricingError';
import { RatesUnavailable } from '../../domain/errors/RatesUnavailable';
import type { ExchangeRate } from '../../domain/model/ExchangeRate';
import { PRICE_NOT_AVAILABLE } from '../../domain/model/Price';
import { CurrencyConversion } from '../../domain/services/CurrencyConversion';
import { PriceList } from '../../domain/services/PriceList';
import { RateChoice } from '../../domain/services/RateChoice';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
    private readonly choice: RateChoice = new RateChoice(),
    private readonly conversion: CurrencyConversion = new CurrencyConversion(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const euro = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    const found = await this.rateToUse(currency);
    if (found === undefined) return { sku: product.sku, name: product.name, currency, reason: PRICE_NOT_AVAILABLE };
    const price = this.conversion.convert(product, found.rate);
    return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: found.estimated };
  }

  /** The fetched rate when it may be used; the last usable one only when rates cannot be fetched. */
  private async rateToUse(currency: string): Promise<{ rate: ExchangeRate; estimated: boolean } | undefined> {
    const now = this.now();
    try {
      const rate = this.choice.fetched(await this.rates.latestFor(currency), now);
      return rate === undefined ? undefined : { rate, estimated: false };
    } catch (e) {
      if (!(e instanceof RatesUnavailable)) throw e;
      const rate = this.choice.fallback(currency, now);
      return rate === undefined ? undefined : { rate, estimated: true };
    }
  }
}
