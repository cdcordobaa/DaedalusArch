import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentDeclinedError } from '../../../domain/errors/PaymentDeclinedError';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import { Money } from '../../../domain/model/Money';
import type { Payment } from '../../../domain/model/Payment';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(orderId: string, amount: Money, cardToken: string): Promise<Payment> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the card payment service is unavailable, try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason = charge.declineCode === 'insufficient_funds' ? 'InsufficientFunds' : charge.declineCode === 'expired_card' ? 'CardExpired' : 'Other';
      throw new PaymentDeclinedError(reason);
    }
    return { status: 'paid', amount: Money.ofCents(charge.amountMinor, charge.currency), reference: charge.chargeId };
  }
}
