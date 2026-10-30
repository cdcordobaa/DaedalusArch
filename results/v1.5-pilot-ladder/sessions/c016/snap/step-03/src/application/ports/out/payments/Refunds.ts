import type { RefundResult } from '../../in/RefundDeposit';

/** Money sent back to the card a guest paid with, in euros, in the application's own terms. */
export interface Refunds {
  refund(paymentId: string, amount: number): Promise<RefundResult>;
}
