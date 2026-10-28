import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamCharge, PaystreamClient } from 'paystream-sdk';
import type { Charges } from '../../../application/ports/out/Charges';
import { PaymentDeclinedError, PaymentUnavailableError } from '../../../domain/errors/PaymentError';
import type { ChargeReceipt } from '../../../domain/model/ChargeReceipt';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment service is unavailable, please try again');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason = charge.declineCode === 'insufficient_funds' || charge.declineCode === 'expired_card' ? charge.declineCode : 'other';
      throw new PaymentDeclinedError(reason);
    }
    return { reference: charge.chargeId };
  }
}
