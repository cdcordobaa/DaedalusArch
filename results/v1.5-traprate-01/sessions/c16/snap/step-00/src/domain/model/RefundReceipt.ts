/** A refund the payment provider has accepted; settled once the money is back with the customer. */
export interface RefundReceipt {
  readonly reference: string;
  readonly settled: boolean;
}
