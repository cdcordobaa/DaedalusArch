import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import type { CardChargeResult, CardPayments } from '../../../application/ports/out/CardPayments';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(orderId: string, amount: Money, cardToken: string): Promise<CardChargeResult> {
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
      if (e instanceof PaystreamUnavailableError) {
        return { paid: false, unavailable: true, reason: 'unavailable' };
      }
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      return { paid: false, reason: charge.declineCode ?? 'declined' };
    }
    return { paid: true, reference: charge.chargeId };
  }
}
