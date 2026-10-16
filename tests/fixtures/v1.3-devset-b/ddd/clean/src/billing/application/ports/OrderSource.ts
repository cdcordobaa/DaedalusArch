/** Port: what billing needs to know about an order, in billing's own terms. */
export interface BillableOrder {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
}

export interface OrderSource {
  billableOrder(orderId: string): Promise<BillableOrder | null>;
}
