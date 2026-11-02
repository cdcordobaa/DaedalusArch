import type { PaystreamClient } from 'paystream-sdk';
import type { Charges, ChargeResult } from '../../../application/ports/out/Charges';
import { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeResult> {
    const charge = await this.client.charge({
      amountMinor: amount.cents,
      currency: amount.currency,
      source: { token: cardToken },
      captureMethod: 'automatic',
      merchantReference: orderId,
    });
    if (charge.state !== 'SUCCEEDED') {
      return { succeeded: false, reason: charge.declineCode ?? 'declined' };
    }
    return { succeeded: true, reference: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
