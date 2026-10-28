import type { Order } from '../model/Order';
import type { Payment } from '../model/Payment';

/** Our own invoice: the customer pays the order total by bank transfer. */
export class Invoicing {
  invoiceFor(order: Order): Payment {
    return { status: 'invoiced', amount: order.total, reference: `INV-${order.id}` };
  }
}
