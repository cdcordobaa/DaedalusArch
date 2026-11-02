import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';
import type { OfferedCurrencies } from '../ports/out/OfferedCurrencies';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly currencies?: OfferedCurrencies,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.eurTo(currency);
    if (rate === null) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON };
    }
    const decimals = await this.decimalsFor(currency);
    const amount = roundPrice(price.amount * rate.mid, currency, decimals);
    return { sku: product.sku, name: product.name, currency, amount, estimated: rate.estimated };
  }

  private async decimalsFor(currency: string): Promise<number> {
    if (currency === 'CHF' || this.currencies === undefined) return 2;
    const all = await this.currencies.all();
    const found = all.find((c) => c.code === currency);
    return found !== undefined && Number.isInteger(found.decimals) && found.decimals >= 0 ? found.decimals : 2;
  }
}

/** Round to the currency's decimals (CHF: nearest 0.05), halves up, never to zero. */
function roundPrice(value: number, currency: string, decimals: number): number {
  const scale = 10 ** (currency === 'CHF' ? 2 : decimals);
  const step = currency === 'CHF' ? 5 : 1;
  // Trim float noise so exact halves round up.
  const units = Math.max(1, Math.round(Number((value * scale / step).toPrecision(12))));
  return (units * step) / scale;
}
