import type { Checkout } from '../../../application/ports/in/Checkout';
import type { RefundPayment } from '../../../application/ports/in/RefundPayment';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /checkout and POST /refunds. */
export class PaymentsController {
  constructor(
    private readonly checkouts: Checkout,
    private readonly refunds: RefundPayment,
  ) {}

  async postCheckout(body: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const view = await this.checkouts.checkout({ orderId: String(body.orderId ?? ''), total: Number(body.total), currency: String(body.currency ?? ''), cardToken: String(body.cardToken ?? '') });
      return { status: 200, body: view };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async postRefund(body: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const view = await this.refunds.refund({ paymentReference: String(body.paymentReference ?? ''), amount: Number(body.amount), currency: String(body.currency ?? '') });
      return { status: 200, body: view };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
