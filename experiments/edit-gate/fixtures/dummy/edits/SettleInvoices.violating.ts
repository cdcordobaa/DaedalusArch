import type { CustomerRef } from '../../shared-kernel/CustomerRef';
import type { OrderRepository } from '../../sales/domain/order/OrderRepository';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository';

export class SettleInvoices {
  constructor(private readonly invoices: InvoiceRepository, private readonly orders: OrderRepository) {}

  /** Marks the oldest unpaid invoice of the customer as paid, and ships its order. */
  async execute(customer: CustomerRef, orderId: string): Promise<string | null> {
    const [first] = await this.invoices.unpaidFor(customer);
    if (first === undefined) return null;
    first.markPaid();
    await this.invoices.save(first);
    const order = await this.orders.byId(orderId);
    if (order !== undefined) {
      order.markShipped();
      await this.orders.save(order);
    }
    return first.id;
  }
}
