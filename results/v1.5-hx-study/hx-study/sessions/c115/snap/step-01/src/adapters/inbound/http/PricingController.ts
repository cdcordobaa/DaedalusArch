import type { ListCurrencies } from '../../../application/ports/in/ListCurrencies';
import type { PriceProduct } from '../../../application/ports/in/PriceProduct';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** GET /products/:sku/price?currency= and GET /currencies. */
export class PricingController {
  constructor(
    private readonly prices: PriceProduct,
    private readonly currencies: ListCurrencies,
  ) {}

  async getPrice(sku: string, query: Record<string, string | undefined>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.prices.price(sku, query.currency ?? 'EUR') };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async getCurrencies(): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.currencies.offered() };
    } catch (e) {
      return { status: 502, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
