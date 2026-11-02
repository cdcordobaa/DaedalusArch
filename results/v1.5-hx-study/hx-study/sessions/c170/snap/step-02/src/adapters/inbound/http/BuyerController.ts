import type { OrderFlour } from '../../../application/ports/in/OrderFlour';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** GET /flours and POST /orders, for the bakery's buyer screen. */
export class BuyerController {
  constructor(private readonly flour: OrderFlour) {}

  getFlours(): Promise<HttpResponse> {
    return this.run(() => this.flour.flours());
  }

  postOrder(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.flour.order({ orderId: String(body.orderId ?? ''), sku: String(body.sku ?? ''), bags: Number(body.bags), deliverOn: String(body.deliverOn ?? '') }));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
