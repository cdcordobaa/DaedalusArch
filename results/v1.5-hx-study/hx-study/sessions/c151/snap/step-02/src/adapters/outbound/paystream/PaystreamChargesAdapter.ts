import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import type { Charges, ChargeResult } from '../../../application/ports/out/Charges';
import { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeResult> {
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
      if (e instanceof PaystreamUnavailableError) return { approved: false, unavailable: true, reason: 'unavailable' };
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      return { approved: false, reason: charge.declineCode ?? 'declined' };
    }
    return { approved: true, reference: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
