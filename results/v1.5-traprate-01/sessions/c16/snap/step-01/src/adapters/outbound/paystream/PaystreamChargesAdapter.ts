import type { PaystreamClient } from 'paystream-sdk';
import type { Charges, ChargeReceipt } from '../../../application/ports/out/Charges';
import { PaymentError } from '../../../domain/errors/PaymentError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt> {
    const charge = await this.client.charge({
      amountMinor: amount.cents,
      currency: amount.currency,
      source: { token: cardToken },
      captureMethod: 'automatic',
      merchantReference: orderId,
    });
    if (charge.state !== 'SUCCEEDED') {
      throw new PaymentError(`card payment declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { reference: charge.chargeId };
  }
}
