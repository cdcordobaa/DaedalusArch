import type { OrderPaidCommand } from '../contracts/OrderCommands.js';

/** Subscriber: relayed from billing's outbox after the invoice was saved; ordering changes in its own transaction. */
export class OnInvoicePaid {
  constructor(private readonly orders: OrderPaidCommand) {}

  handle(event: { readonly orderId: string }): Promise<void> {
    return this.orders.markPaid(event.orderId);
  }
}
