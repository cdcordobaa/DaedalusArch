import type { PlaceOrder, PlaceOrderCommand } from '../application/PlaceOrder.js';
import type { IssueInvoice } from '../../billing/application/IssueInvoice.js';

/** Inbound adapter: translates a request body into a command. */
export class OrderController {
  constructor(private readonly placeOrder: PlaceOrder, private readonly invoicing?: IssueInvoice) {}

  async post(body: PlaceOrderCommand): Promise<{ status: number }> {
    await this.placeOrder.execute(body);
    if (this.invoicing !== undefined) await this.invoicing.execute(`inv-${body.orderId}`, body.orderId);
    return { status: 201 };
  }
}
