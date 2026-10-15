import type { OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';
import type { OrderLine } from '../domain/order/OrderLine.js';

/** Query service behind the published OrderSummaryQuery contract. */
export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: OrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(new OrderId(orderId));
    if (order === null) return null;
    const total = order.total();
    return { orderId, customerId: order.customerId.value, totalCents: total.cents, currency: total.currency, lineCount: order.lineCount() };
  }

  // VIOLATION (aggregate boundary): code outside the Order aggregate names its inner entity OrderLine.
  describeLine(line: OrderLine): string {
    return `${String(line.lineNo)} ${line.productId} ${String(line.subtotal().cents)}`;
  }
}
