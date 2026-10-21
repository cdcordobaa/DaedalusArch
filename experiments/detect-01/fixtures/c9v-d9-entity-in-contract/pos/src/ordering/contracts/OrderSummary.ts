import type { OrderLine } from '../domain/order/OrderLine.js';

/** Published language of the ordering context. */
export interface OrderSummary {
  readonly orderId: string;
  readonly customerId: string;
  readonly lines: readonly OrderLine[];
}

export interface OrderLineSummary {
  readonly lineNo: number;
  readonly productId: string;
  readonly grossCents: number;
  readonly discountCents: number;
  readonly discountReason: string | null;
  readonly subtotalCents: number;
}

export interface OrderSummaryQuery {
  summaryOf(orderId: string): Promise<OrderSummary | null>;
}
