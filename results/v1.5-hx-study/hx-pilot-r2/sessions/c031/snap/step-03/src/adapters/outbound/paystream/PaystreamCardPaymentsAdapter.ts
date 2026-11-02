import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardCharge, CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, type CardDeclineReason } from '../../../domain/errors/CardDeclinedError';
import { PaymentProviderUnavailableError } from '../../../domain/errors/PaymentProviderUnavailableError';
import { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentProviderUnavailableError('the payment provider is unavailable, try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason: CardDeclineReason =
        charge.declineCode === 'insufficient_funds' ? 'not-enough-money'
        : charge.declineCode === 'expired_card' ? 'card-out-of-date'
        : 'unspecified';
      throw new CardDeclinedError(reason);
    }
    return { reference: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
