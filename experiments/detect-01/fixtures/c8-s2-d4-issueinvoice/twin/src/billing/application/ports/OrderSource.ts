export interface BillableOrder {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
}

/** Driven port: billing reads what it needs of an order. */
export interface OrderSource {
  billableOrder(orderId: string): Promise<BillableOrder | null>;
}
