import { randomUUID } from 'node:crypto';
import type { PaymentGateway, PaymentResult } from '../../application/ports/payment-gateway';

/** PaddlePay card payments. No network in this service yet: charges are recorded in memory. */
export class PaddlePayClient implements PaymentGateway {
  readonly ledger: { paymentId: string; customerEmail: string; amountCents: number; reference: string }[] = [];

  constructor(private readonly merchantId = 'lake-kayaks') {}

  async charge(customerEmail: string, amountCents: number, reference: string): Promise<PaymentResult> {
    if (amountCents <= 0) throw new Error('PaddlePay: amount must be positive');
    const paymentId = `pp_${this.merchantId}_${randomUUID()}`;
    this.ledger.push({ paymentId, customerEmail, amountCents, reference });
    return { paymentId, amountCents };
  }

  async refund(paymentId: string): Promise<PaymentResult> {
    const paid = this.ledger.find((p) => p.paymentId === paymentId);
    if (paid === undefined) throw new Error(`PaddlePay: no payment ${paymentId}`);
    const refundId = `pp_${this.merchantId}_${randomUUID()}`;
    this.ledger.push({ ...paid, paymentId: refundId, amountCents: -paid.amountCents, reference: `refund of ${paymentId}` });
    return { paymentId: refundId, amountCents: paid.amountCents };
  }
}
