import type { OrderInvoicedCommand } from '../../ordering/index.js';
import type { OrderInvoicedNotifier } from '../application/ports/OrderInvoiced.js';

export class OrderingInvoicedAcl implements OrderInvoicedNotifier {
  constructor(private readonly ordering: OrderInvoicedCommand) {}

  orderInvoiced(orderId: string): Promise<void> {
    return this.ordering.markInvoiced(orderId);
  }
}
