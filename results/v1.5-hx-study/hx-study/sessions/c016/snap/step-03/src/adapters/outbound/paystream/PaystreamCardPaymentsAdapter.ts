import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamCharge, PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, type DeclineReason } from '../../../domain/errors/CardDeclinedError';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import { Money } from '../../../domain/model/Money';
import type { Payment } from '../../../domain/model/Payment';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<Payment> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment provider is unavailable, try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason: DeclineReason =
        charge.declineCode === 'insufficient_funds' ? 'not-enough-money' : charge.declineCode === 'expired_card' ? 'card-lapsed' : 'refused';
      throw new CardDeclinedError(reason);
    }
    return { status: 'paid', amount: Money.ofCents(charge.amountMinor, charge.currency), reference: charge.chargeId };
  }
}
