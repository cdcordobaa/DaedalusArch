import { PaystreamUnavailableError, type PaystreamCharge, type PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, PaymentUnavailableError } from '../../../domain/errors/PaymentError';
import { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(orderId: string, cardToken: string, amount: Money): Promise<{ amount: Money; reference: string }> {
    let charge: PaystreamCharge;
    try {
      charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment provider is unavailable, please try again');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason = charge.declineCode === 'insufficient_funds' ? 'insufficient_funds' : charge.declineCode === 'expired_card' ? 'expired_card' : 'other';
      throw new CardDeclinedError(reason, `the card was declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { amount: Money.ofCents(charge.amountMinor, charge.currency), reference: charge.chargeId };
  }
}
