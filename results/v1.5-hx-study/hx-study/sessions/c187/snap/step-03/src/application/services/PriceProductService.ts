import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

/**
 * Rounds to the currency's smallest written unit (Swiss franc: 0.05, otherwise
 * 10^-decimals), halves up, never to zero (guarding against binary float noise).
 */
function roundPrice(value: number, currency: string, decimals: number): number {
  const perUnit = currency === 'CHF' ? 20 : 10 ** decimals; // units per 1.00
  const units = Math.max(1, Math.round(Number((value * perUnit).toPrecision(12))));
  return units / perUnit;
}

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const price = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.euroTo(currency);
    if (rate === null || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, estimated: false, reason: UNAVAILABLE_REASON };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: roundPrice(price.amount * rate.mid, currency, rate.decimals),
      estimated: rate.estimated === true,
    };
  }
}
