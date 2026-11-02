import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

export const UNAVAILABLE_REASON = 'Prices in this currency are not available right now.';

/**
 * Rounds an amount given in hundredths of the currency unit to the currency's convention:
 * Ratewise's decimals, or 0.05 for CHF. Halves round up; never returns zero.
 */
function roundPrice(hundredths: number, currency: string, minorUnits: number): number {
  const clean = Number(hundredths.toPrecision(12)); // trims float noise
  if (currency === 'CHF') {
    const steps = Math.max(1, Math.round(Number((clean / 5).toPrecision(12))));
    return Number((steps * 0.05).toFixed(2));
  }
  const scale = Math.pow(10, minorUnits);
  const units = Math.max(1, Math.round(Number(((clean / 100) * scale).toPrecision(12))));
  return Number((units / scale).toFixed(minorUnits));
}

export class PriceProductService implements PriceProduct {
  constructor(
    private readonly rates: ExchangeRates,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    const euro = this.prices.euroPrice(product);
    if (currency === 'EUR') {
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    const rate = await this.rates.fromEuro(currency);
    if (rate === null || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE_REASON, estimated: false };
    }
    const amount = roundPrice(product.euroCents * rate.mid, currency, rate.minorUnits);
    return { sku: product.sku, name: product.name, currency, amount, estimated: rate.estimated };
  }
}
