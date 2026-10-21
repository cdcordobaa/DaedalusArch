import type { OrderPaidCommand } from '../../ordering/index.js';
import type { OrderPaidNotifier } from '../application/ports/OrderPaid.js';

export class OrderingPaidAcl implements OrderPaidNotifier {
  constructor(private readonly ordering: OrderPaidCommand) {}

  orderPaid(orderId: string): Promise<void> {
    return this.ordering.markPaid(orderId);
  }
}
