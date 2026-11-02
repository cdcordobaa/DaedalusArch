import type { PaystreamClient } from 'paystream-sdk';
import type { CardCharge, CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, type DeclineReason } from '../../../domain/errors/CardDeclinedError';
import { PaymentError } from '../../../domain/errors/PaymentError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge> {
    const charge = await this.client.charge({
      amountMinor: amount.cents,
      currency: amount.currency,
      source: { token: cardToken },
      captureMethod: 'automatic',
      merchantReference: orderId,
    });
    if (charge.state !== 'SUCCEEDED') {
      if (charge.state === 'DECLINED') {
        const code = charge.declineCode;
        const reason: DeclineReason =
          code === 'insufficient_funds' ? 'not-enough-money' : code === 'expired_card' ? 'card-out-of-date' : 'other';
        throw new CardDeclinedError(reason);
      }
      throw new PaymentError('card payment was not completed');
    }
    return { reference: charge.chargeId };
  }
}
