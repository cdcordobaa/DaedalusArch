import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardChargeReceipt, CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, PaymentUnavailableError } from '../../../domain/errors/PaymentError';
import { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeReceipt> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment provider is unavailable, please try again');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const code = charge.declineCode;
      throw new CardDeclinedError(code === 'insufficient_funds' || code === 'expired_card' ? code : 'other');
    }
    return { reference: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
