import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const UNAVAILABLE = 'Prices in this currency are not available right now.';
const DIGITS = 10;

/**
 * euroCents * mid, rounded half up to the currency's smallest shown step, computed exactly on the decimal rate.
 * Never returns zero: a result that rounds to zero becomes one step.
 */
function convert(euroCents: number, mid: number, currency: string, minorUnits: number): number {
  const swiss = currency === 'CHF';
  const decimals = swiss ? 2 : minorUnits;
  const step = swiss ? 5n : 1n;
  const scale = 10n ** BigInt(DIGITS);
  const scaledMid = BigInt(mid.toFixed(DIGITS).replace('.', ''));
  const denom = 100n * scale * step;
  const num = BigInt(euroCents) * scaledMid * 10n ** BigInt(decimals);
  let steps = (num + denom / 2n) / denom;
  if (steps === 0n) steps = 1n;
  return Number(steps * step) / 10 ** decimals;
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
    const rate = await this.rates.euroTo(currency);
    if (rate === null || rate.currency !== currency) {
      return { sku: product.sku, name: product.name, currency, amount: null, reason: UNAVAILABLE };
    }
    return {
      sku: product.sku,
      name: product.name,
      currency,
      amount: convert(product.euroCents, rate.mid, currency, rate.minorUnits),
      estimated: rate.estimated === true,
    };
  }
}
