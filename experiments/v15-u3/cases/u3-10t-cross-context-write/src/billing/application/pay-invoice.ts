import type { Invoice } from '../domain/invoice/Invoice';
import type { OrderRepository } from '../../ordering/domain/order/OrderRepository';

export class PayInvoice {
  constructor(private readonly orders: OrderRepository) {}

  run(invoice: Invoice): void {
    invoice.markPaid();
    const order = this.orders.byId(invoice.orderId);
    order.markPaid();
    this.orders.save(order);
  }
}
