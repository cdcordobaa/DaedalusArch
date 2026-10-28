import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import { ChargesDeclinedError, ChargesUnavailableError, type Charges, type ChargeReceipt } from '../../../application/ports/out/Charges';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt> {
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
      const reason =
        charge.declineCode === 'insufficient_funds' ? 'insufficient_funds'
        : charge.declineCode === 'expired_card' ? 'expired_card'
        : 'other';
      throw new ChargesDeclinedError(reason, `card payment declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { reference: charge.chargeId };
  }
}
