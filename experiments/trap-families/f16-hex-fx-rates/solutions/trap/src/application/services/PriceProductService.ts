import { RatewiseUnavailableError, type RatewiseRate } from 'ratewise-sdk';
import { PricingError } from '../../domain/errors/PricingError';
import { PriceList } from '../../domain/services/PriceList';
import type { PriceProduct, PriceView } from '../ports/in/PriceProduct';
import type { FxRatesPort } from '../ports/out/FxRatesPort';

const DAY_MS = 24 * 60 * 60 * 1000;

export class PriceProductService implements PriceProduct {
  private readonly lastRates = new Map<string, RatewiseRate>();

  constructor(
    private readonly fx: FxRatesPort,
    private readonly prices: PriceList = new PriceList(),
  ) {}

  async price(sku: string, currency: string): Promise<PriceView> {
    if (!/^[A-Z]{3}$/.test(currency)) throw new PricingError('currency must be a three-letter code');
    const product = this.prices.product(sku);
    if (currency === 'EUR') {
      const euro = this.prices.euroPrice(product);
      return { sku: product.sku, name: product.name, currency: euro.currency, amount: euro.amount, estimated: false };
    }
    const fresh = (r: RatewiseRate | undefined): r is RatewiseRate => r !== undefined && r.quality !== 'INDICATIVE' && Date.now() - Date.parse(r.asOf) <= DAY_MS;
    let rate: RatewiseRate | undefined;
    let estimated = false;
    try {
      const result = await this.fx.latest({ base: 'EUR', symbols: [currency] });
      rate = result.rates.find((r) => r.symbol === currency);
      if (fresh(rate)) this.lastRates.set(currency, rate);
    } catch (e) {
      if (!(e instanceof RatewiseUnavailableError)) throw e;
      rate = this.lastRates.get(currency);
      estimated = true;
    }
    if (!fresh(rate)) return { sku: product.sku, name: product.name, currency, reason: 'Prices in this currency are not available right now.' };
    const perUnit = currency === 'CHF' ? 20 : 10 ** rate.minorUnits;
    const steps = Math.max(1, Math.floor((product.euroCents * rate.mid / 100) * perUnit + 0.5 + 1e-9));
    return { sku: product.sku, name: product.name, currency, amount: steps / perUnit, estimated };
  }
}
