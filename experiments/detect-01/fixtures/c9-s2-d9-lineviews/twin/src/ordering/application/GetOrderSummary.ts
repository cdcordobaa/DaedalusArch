import type { OrderLineSummary, OrderSummary, OrderSummaryQuery } from '../contracts/OrderSummary.js';
import type { OrderLine } from '../domain/order/OrderLine.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

/** Query service behind the published OrderSummaryQuery contract: maps the domain model to the published language. */
export class GetOrderSummary implements OrderSummaryQuery {
  constructor(private readonly orders: OrderRepository) {}

  async summaryOf(orderId: string): Promise<OrderSummary | null> {
    const order = await this.orders.byId(orderId);
    if (order === null) return null;
    return { orderId, customerId: order.customerId, lines: order.allLines().map(toSummary) };
  }
}

function toSummary(l: OrderLine): OrderLineSummary {
  return {
    lineNo: l.lineNo,
    productId: l.productId,
    grossCents: l.gross().cents,
    discountCents: l.discountAmount().cents,
    discountReason: l.discountReason(),
    subtotalCents: l.subtotal().cents,
  };
}
