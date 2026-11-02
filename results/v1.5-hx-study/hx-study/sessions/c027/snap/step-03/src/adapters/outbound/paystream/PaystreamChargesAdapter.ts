import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamCharge, PaystreamClient } from 'paystream-sdk';
import type { Charges } from '../../../application/ports/out/Charges';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import { PaymentDeclinedError } from '../../../domain/errors/PaymentDeclinedError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<string> {
    let charge: PaystreamCharge;
    try {
      charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError();
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      throw new PaymentDeclinedError(
        charge.declineCode === 'insufficient_funds' ? 'insufficient_funds' : charge.declineCode === 'expired_card' ? 'expired_card' : 'other',
      );
    }
    return charge.chargeId;
  }
}
