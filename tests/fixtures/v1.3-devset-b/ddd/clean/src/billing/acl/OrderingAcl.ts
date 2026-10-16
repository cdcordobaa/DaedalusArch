import type { OrderSummaryQuery } from '../../ordering/index.js';
import type { BillableOrder, OrderSource } from '../application/ports/OrderSource.js';

/** Anti-corruption layer: translates ordering's published language into billing's model. */
export class OrderingAcl implements OrderSource {
  constructor(private readonly ordering: OrderSummaryQuery) {}

  async billableOrder(orderId: string): Promise<BillableOrder | null> {
    const summary = await this.ordering.summaryOf(orderId);
    if (summary === null) return null;
    return { orderId: summary.orderId, amountCents: summary.totalCents, currency: summary.currency };
  }
}
