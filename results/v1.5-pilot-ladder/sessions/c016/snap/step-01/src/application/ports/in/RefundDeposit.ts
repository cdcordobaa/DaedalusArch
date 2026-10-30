export type RefundResult = 'refunded' | 'refund_pending' | 'refund_failed';

export interface RefundView {
  readonly paymentId: string;
  readonly result: RefundResult;
}

export interface RefundDeposit {
  refund(paymentId: string, amount: number): Promise<RefundView>;
}
