/** Published command of the ordering context. */
export interface OrderInvoicedCommand {
  markInvoiced(orderId: string): Promise<void>;
}


export interface OrderAmount {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
}

/** Published query of the ordering context. */
export interface OrderAmountQuery {
  amountOf(orderId: string): Promise<OrderAmount | null>;
}
