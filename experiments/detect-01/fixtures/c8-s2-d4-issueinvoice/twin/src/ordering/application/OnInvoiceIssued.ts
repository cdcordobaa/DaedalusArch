import type { OrderInvoicedCommand } from '../contracts/OrderCommands.js';

/** Subscriber: relayed from billing's outbox; ordering freezes the order in its own transaction. */
export class OnInvoiceIssued {
  constructor(private readonly orders: OrderInvoicedCommand) {}

  handle(event: { readonly orderId: string }): Promise<void> {
    return this.orders.markInvoiced(event.orderId);
  }
}
