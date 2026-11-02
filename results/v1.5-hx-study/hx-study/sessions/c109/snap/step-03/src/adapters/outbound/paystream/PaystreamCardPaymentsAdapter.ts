import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardChargeResult, CardDeclineReason, CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import type { Money } from '../../../domain/model/Money';

function declineReason(code: string | undefined): CardDeclineReason {
  if (code === 'insufficient_funds') return 'insufficientFunds';
  if (code === 'expired_card') return 'expired';
  return 'other';
}

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
      return { approved: false, reason: declineReason(charge.declineCode) };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the card payment service is unavailable, try again later');
      throw e;
    }
  }
}
