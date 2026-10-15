import type { OrderSummaryQuery } from '../../ordering/index.js';
// Allowed (anti-corruption layer exception): the ACL may reach an internal ordering file to translate it.
import { OrderId } from '../../ordering/domain/order/value-objects/OrderId.js';
import type { BillableOrder, OrderSource } from '../application/ports/OrderSource.js';

/** Anti-corruption layer: translates ordering's published language into billing's model. */
export class OrderingAcl implements OrderSource {
  constructor(private readonly ordering: OrderSummaryQuery) {}

  async billableOrder(orderId: string): Promise<BillableOrder | null> {
    const summary = await this.ordering.summaryOf(new OrderId(orderId).value);
    if (summary === null) return null;
    return { orderId: summary.orderId, amountCents: summary.totalCents, currency: summary.currency };
  }
}
