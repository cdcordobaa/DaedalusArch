import { PaymentError } from '../../domain/errors/PaymentError';
import { Money } from '../../domain/model/Money';
import type { RefundPayment, RefundRequest, RefundView } from '../ports/in/RefundPayment';
import type { Refunds } from '../ports/out/Refunds';

export class RefundPaymentService implements RefundPayment {
  constructor(private readonly refunds: Refunds) {}

  async refund(request: RefundRequest): Promise<RefundView> {
    const amount = Money.of(request.amount, request.currency);
    if (!amount.isPositive()) throw new PaymentError('the refund amount must be positive');
    const receipt = await this.refunds.refund(request.paymentReference, amount);
    return { reference: receipt.reference, settled: receipt.settled };
  }
}
