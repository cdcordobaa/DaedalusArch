import type { OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { InMemoryOrderRepository } from '../infrastructure/InMemoryOrderRepository.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';

/** Query service behind the published OrderSummaryQuery contract. */
export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: InMemoryOrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(new OrderId(orderId));
    if (order === null) return null;
    const total = order.total();
    return { orderId, customerId: order.customerId.value, totalCents: total.cents, currency: total.currency, lineCount: order.lineCount() };
  }
}
