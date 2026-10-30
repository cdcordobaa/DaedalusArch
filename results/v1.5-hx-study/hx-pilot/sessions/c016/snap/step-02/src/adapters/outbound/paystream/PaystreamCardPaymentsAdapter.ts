import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentError } from '../../../domain/errors/PaymentError';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(orderId: string, amount: Money, cardToken: string): Promise<{ reference: string }> {
    try {
      const charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
      if (charge.state !== 'SUCCEEDED') {
        throw new PaymentError(`the card was declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
      }
      return { reference: charge.chargeId };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment service is unavailable, try again later');
      throw e;
    }
  }
}
