import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentError } from '../../../domain/errors/PaymentError';
import { PaymentDeclinedError, type DeclineReason } from '../../../domain/errors/PaymentDeclinedError';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(orderId: string, amount: Money, cardToken: string): Promise<string> {
    let charge;
    try {
      charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment service is unavailable, please try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      if (charge.state === 'DECLINED') {
        const reason: DeclineReason = charge.declineCode === 'insufficient_funds' ? 'insufficient-funds' : charge.declineCode === 'expired_card' ? 'card-expired' : 'other';
        throw new PaymentDeclinedError(reason);
      }
      throw new PaymentError(`the card was not charged`);
    }
    return charge.chargeId;
  }
}
