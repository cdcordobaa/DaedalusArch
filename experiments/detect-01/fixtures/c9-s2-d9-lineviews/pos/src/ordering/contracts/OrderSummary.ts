/** Published language of the ordering context. */
export interface OrderSummary {
  readonly orderId: string;
  readonly customerId: string;
  readonly lines: readonly OrderLineSummary[];
}

export interface OrderLineSummary {
  readonly lineNo: number;
  readonly productId: string;
  /** Before discount. */
  readonly grossCents: number;
  readonly discountCents: number;
  readonly discountReason: string | null;
  /** After discount, before tax. */
  readonly subtotalCents: number;
}

export interface OrderSummaryQuery {
  summaryOf(orderId: string): Promise<OrderSummary | null>;
}
