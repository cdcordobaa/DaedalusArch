import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import { PaymentsUnavailableError } from '../../../domain/errors/PaymentsUnavailableError';
import type { CardChargeResult, Payments } from '../../../application/ports/out/Payments';
import type { Money } from '../../../domain/model/Money';

export class PaystreamPaymentsAdapter implements Payments {
  constructor(private readonly client: PaystreamClient) {}

  async chargeCard(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentsUnavailableError(e.message);
      throw e;
    }
    return { approved: charge.state === 'SUCCEEDED', reference: charge.chargeId, declineReason: charge.declineCode };
  }
}
