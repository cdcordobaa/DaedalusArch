import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import { CardDeclinedError, CardPaymentsUnavailableError, type CardChargeResult, type CardPayments } from '../../../application/ports/out/CardPayments';
import { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult> {
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
      if (e instanceof PaystreamUnavailableError) throw new CardPaymentsUnavailableError(e.message);
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const code = charge.declineCode;
      throw new CardDeclinedError(code === 'insufficient_funds' ? 'insufficient_funds' : code === 'expired_card' ? 'expired_card' : 'other');
    }
    return { chargeId: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
