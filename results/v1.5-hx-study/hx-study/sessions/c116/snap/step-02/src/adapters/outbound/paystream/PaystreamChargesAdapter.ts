import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import { ChargesUnavailableError } from '../../../application/ports/out/Charges';
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
      if (e instanceof PaystreamUnavailableError) throw new ChargesUnavailableError(e.message);
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      return { succeeded: false, reason: charge.declineCode ?? 'declined' };
    }
    return { succeeded: true, reference: charge.chargeId, amount: Money.ofCents(charge.amountMinor, charge.currency) };
  }
}
