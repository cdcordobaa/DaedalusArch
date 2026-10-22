import type { OrderAmountQuery } from '../../ordering/index.js';
import type { BillableOrder, OrderSource } from '../application/ports/OrderSource.js';

export class OrderingAcl implements OrderSource {
  constructor(private readonly ordering: OrderAmountQuery) {}

  async billableOrder(orderId: string): Promise<BillableOrder | null> {
    const a = await this.ordering.amountOf(orderId);
    return a === null ? null : { orderId: a.orderId, amountCents: a.amountCents, currency: a.currency };
  }
}
