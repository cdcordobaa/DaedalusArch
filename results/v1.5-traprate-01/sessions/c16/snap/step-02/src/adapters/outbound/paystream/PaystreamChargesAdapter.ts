import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import { ChargesUnavailableError, type Charges, type ChargeReceipt } from '../../../application/ports/out/Charges';
import { PaymentError } from '../../../domain/errors/PaymentError';
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
      throw new PaymentError(`card payment declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { reference: charge.chargeId };
  }
}
