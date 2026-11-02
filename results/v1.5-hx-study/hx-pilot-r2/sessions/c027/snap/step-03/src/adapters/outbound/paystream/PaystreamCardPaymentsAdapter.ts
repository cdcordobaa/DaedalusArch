import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, PaymentProviderUnavailableError } from '../../../domain/errors/PaymentError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<{ chargeId: string }> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentProviderUnavailableError('the payment provider is unavailable, please try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const code = charge.declineCode;
      throw new CardDeclinedError(code === 'insufficient_funds' ? 'insufficient_funds' : code === 'expired_card' ? 'expired_card' : 'other');
    }
    return { chargeId: charge.chargeId };
  }
}
