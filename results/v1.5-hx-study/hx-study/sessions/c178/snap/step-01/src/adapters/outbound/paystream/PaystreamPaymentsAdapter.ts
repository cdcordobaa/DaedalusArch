import type { PaystreamClient } from 'paystream-sdk';
import type { CardChargeResult, Payments } from '../../../application/ports/out/Payments';
import type { Money } from '../../../domain/model/Money';

export class PaystreamPaymentsAdapter implements Payments {
  constructor(private readonly client: PaystreamClient) {}

  async chargeCard(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult> {
    const charge = await this.client.charge({
      amountMinor: amount.cents,
      currency: amount.currency,
      source: { token: cardToken },
      captureMethod: 'automatic',
      merchantReference: orderId,
    });
    return { approved: charge.state === 'SUCCEEDED', reference: charge.chargeId, declineReason: charge.declineCode };
  }
}
