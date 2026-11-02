import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardChargeResult, CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult> {
    try {
      const charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
      if (charge.state === 'SUCCEEDED') return { approved: true, reference: charge.chargeId };
      return { approved: false, reason: charge.declineCode ?? 'declined' };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the card payment service is unavailable, try again later');
      throw e;
    }
  }
}
