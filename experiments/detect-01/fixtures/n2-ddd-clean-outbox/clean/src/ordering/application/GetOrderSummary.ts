import type { OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: OrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(orderId);
    return order === null ? null : { orderId, totalCents: order.totalCents(), lineCount: order.lineCount() };
  }
}
