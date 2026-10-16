/** Published language of the ordering context. */
export interface OrderSummary {
  readonly orderId: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly lineCount: number;
}

export interface OrderSummaryQuery {
  summaryOf(orderId: string): Promise<OrderSummary | null>;
}
