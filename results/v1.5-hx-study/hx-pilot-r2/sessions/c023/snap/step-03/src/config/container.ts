import { RatewiseClient } from 'ratewise-sdk';
import { PricingController } from '../adapters/inbound/http/PricingController';
import { RatewiseCurrenciesAdapter } from '../adapters/outbound/ratewise/RatewiseCurrenciesAdapter';
import { RatewiseExchangeRatesAdapter } from '../adapters/outbound/ratewise/RatewiseExchangeRatesAdapter';
import { ListCurrenciesService } from '../application/services/ListCurrenciesService';
import { PriceProductService } from '../application/services/PriceProductService';

/** Composition root. The Ratewise key comes from RATEWISE_API_KEY. */
export function createApp() {
  const ratewise = new RatewiseClient({ apiKey: process.env.RATEWISE_API_KEY ?? '' });
  const prices = new PriceProductService(new RatewiseExchangeRatesAdapter(ratewise));
  const currencies = new ListCurrenciesService(new RatewiseCurrenciesAdapter(ratewise));
  const http = new PricingController(prices, currencies);
  return {
    price: (sku: string, currency: string) => prices.price(sku, currency),
    currencies: () => currencies.offered(),
    http,
  };
}
