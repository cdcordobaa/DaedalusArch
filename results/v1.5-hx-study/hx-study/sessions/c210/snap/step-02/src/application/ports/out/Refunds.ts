import type { Money } from '../../../domain/model/Money';
import type { RefundReceipt } from '../../../domain/model/RefundReceipt';

/** Gives money back on an earlier card payment, in the application's own terms. */
export interface Refunds {
  refund(paymentReference: string, amount: Money): Promise<RefundReceipt>;
}
