import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const UNAVAILABLE = 'Prices in this currency are not available right now.';

/** Rounds an amount given in hundredths of the major unit; halves up, never zero. */
function roundPrice(hundredths: number, currency: string, minorUnits: number): number {
  // Steps per major unit: 20 for CHF (0.05), otherwise 10^minorUnits.
  const steps = currency === 'CHF' ? 20 : 10 ** minorUnits;
  // toPrecision absorbs float noise before rounding.
  const scaled = Number(((hundredths / 100) * steps).toPrecision(12));
  return Math.max(1, Math.round(scaled)) / steps;
}

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const price = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: price.currency, amount: price.amount, estimated: false };
    }
    const rate = await this.rates.fromEuro(currency);
    if (rate === undefined || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    const amount = roundPrice(product.euroCents * rate.mid, currency, rate.minorUnits);
    return { sku: product.sku, name: product.name, currency, amount, estimated: rate.estimated === true };
  }
}
