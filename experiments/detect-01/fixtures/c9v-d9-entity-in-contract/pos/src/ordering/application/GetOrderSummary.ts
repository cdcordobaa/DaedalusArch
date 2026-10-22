import type { OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

/** Query service behind the published OrderSummaryQuery contract. */
export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: OrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(orderId);
    if (order === null) return null;
    return { orderId, customerId: order.customerId, lines: order.allLines() };
  }
}
