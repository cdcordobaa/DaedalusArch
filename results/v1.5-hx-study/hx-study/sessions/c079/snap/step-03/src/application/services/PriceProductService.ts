import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { ExchangeRates } from '../ports/out/ExchangeRates';

const UNAVAILABLE = 'Prices in this currency are not available right now.';
const SCALE = 10;

/**
 * euroCents * mid, rounded to the currency's display increment, halves up (exact decimal arithmetic).
 * Never returns zero: the smallest displayable amount is returned instead.
 */
function convertAmount(euroCents: number, mid: number, currency: string, minorUnits: number): number {
  const digits = BigInt(mid.toFixed(SCALE).replace('.', ''));
  const total = BigInt(euroCents) * digits; // units of 10^-(SCALE+2) of the currency
  const decimals = Number.isInteger(minorUnits) && minorUnits >= 0 && minorUnits <= SCALE + 2 ? minorUnits : 2;
  const chf = currency === 'CHF';
  const step = chf ? 5n * 10n ** BigInt(SCALE) : 10n ** BigInt(SCALE + 2 - decimals);
  let count = (total + step / 2n) / step;
  if (count === 0n) count = 1n;
  return chf ? Number(count * 5n) / 100 : Number(count) / 10 ** decimals;
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
    const rate = await this.rates.latestFromEur(currency);
    if (rate === undefined) {
      return { sku: product.sku, name: product.name, currency, reason: UNAVAILABLE };
    }
    return { sku: product.sku, name: product.name, currency, amount: convertAmount(product.euroCents, rate.mid, currency, rate.minorUnits), estimated: rate.estimated };
  }
}
