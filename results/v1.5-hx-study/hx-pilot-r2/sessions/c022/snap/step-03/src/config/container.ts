import { RatewiseClient } from 'ratewise-sdk';
import { PricingController } from '../adapters/inbound/http/PricingController';
import { RatewiseCurrenciesAdapter } from '../adapters/outbound/ratewise/RatewiseCurrenciesAdapter';
import { RatewiseRatesAdapter } from '../adapters/outbound/ratewise/RatewiseRatesAdapter';
import { ListCurrenciesService } from '../application/services/ListCurrenciesService';
import { PriceProductService } from '../application/services/PriceProductService';

/** Composition root. The Ratewise key comes from RATEWISE_API_KEY. */
export function createApp() {
  const ratewise = new RatewiseClient({ apiKey: process.env.RATEWISE_API_KEY ?? '' });
  const offered = new RatewiseCurrenciesAdapter(ratewise);
  const prices = new PriceProductService(new RatewiseRatesAdapter(ratewise), offered);
  const currencies = new ListCurrenciesService(offered);
  const http = new PricingController(prices, currencies);
  return {
    price: (sku: string, currency: string) => prices.price(sku, currency),
    currencies: () => currencies.offered(),
    http,
  };
}
