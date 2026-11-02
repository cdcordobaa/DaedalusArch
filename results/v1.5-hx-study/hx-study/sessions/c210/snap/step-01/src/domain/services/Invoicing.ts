import type { Order } from '../model/Order';

/** Our own invoice: the customer pays the order total by bank transfer. No longer used by checkout. */
export class Invoicing {
  invoiceFor(order: Order): { status: 'invoiced'; amount: Order['total']; reference: string } {
    return { status: 'invoiced', amount: order.total, reference: `INV-${order.id}` };
  }
}
