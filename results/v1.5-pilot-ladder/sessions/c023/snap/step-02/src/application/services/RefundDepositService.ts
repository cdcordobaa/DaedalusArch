import { BookingError } from '../../domain/errors/BookingError';
import type { RefundDeposit, RefundView } from '../ports/in/RefundDeposit';
import type { Refunds } from '../ports/out/Refunds';

export class RefundDepositService implements RefundDeposit {
  constructor(private readonly refunds: Refunds) {}

  async refund(paymentId: string, amount: number): Promise<RefundView> {
    if (!(amount > 0)) throw new BookingError('a refund needs a positive amount');
    return { paymentId, result: await this.refunds.refund(paymentId, amount) };
  }
}
