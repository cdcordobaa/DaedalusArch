import type { PlaceOrder, PlaceOrderCommand } from '../application/PlaceOrder.js';
import type { InvoiceView } from '../../billing/index.js';

/** Inbound adapter: translates a request body into a command. */
export class OrderController {
  constructor(private readonly placeOrder: PlaceOrder) {}

  async post(body: PlaceOrderCommand): Promise<{ status: number }> {
    await this.placeOrder.execute(body);
    return { status: 201 };
  }

  invoiceLink(view: InvoiceView): string {
    return `/orders/${view.orderId}/invoices/${view.invoiceId}`;
  }
}
