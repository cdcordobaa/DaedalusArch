import type { BouquetOrders } from '../../../application/ports/in/BouquetOrders';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The order pages of the shop website and the staff screens. */
export class OrderController {
  constructor(private readonly orders: BouquetOrders) {}

  postOrder(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(() => this.orders.place({
      orderId: String(body.orderId ?? ''),
      recipient: String(body.recipient ?? ''),
      street: String(body.street ?? ''),
      postcode: String(body.postcode ?? ''),
      city: String(body.city ?? ''),
      message: String(body.message ?? ''),
    }));
  }

  postSend(orderId: string): Promise<HttpResponse> {
    return this.run(() => this.orders.send(orderId));
  }

  getStatus(orderId: string): Promise<HttpResponse> {
    return this.run(() => this.orders.status(orderId));
  }

  putMessage(orderId: string, message: string): Promise<HttpResponse> {
    return this.run(() => this.orders.changeMessage(orderId, message));
  }

  getLastSeen(orderId: string): Promise<HttpResponse> {
    return this.run(async () => ({ line: await this.orders.lastSeen(orderId) }));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
