import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { CardChargeResult, CardPayments } from '../../../application/ports/out/CardPayments';
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
      if (charge.state === 'SUCCEEDED') return { outcome: 'charged', paymentReference: charge.chargeId };
      return { outcome: 'declined', reason: charge.declineCode ?? 'declined' };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) return { outcome: 'unavailable' };
      throw e;
    }
  }
}
