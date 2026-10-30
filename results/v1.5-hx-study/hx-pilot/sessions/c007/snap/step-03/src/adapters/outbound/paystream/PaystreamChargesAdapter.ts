import { PaystreamUnavailableError, type PaystreamClient } from 'paystream-sdk';
import type { Charges } from '../../../application/ports/out/Charges';
import { PaymentDeclinedError, PaymentUnavailableError } from '../../../domain/errors/PaymentError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<{ reference: string }> {
    try {
      const charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
      if (charge.state !== 'SUCCEEDED') {
        throw new PaymentDeclinedError(
          `card payment declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`,
          charge.declineCode,
        );
      }
      return { reference: charge.chargeId };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('card payment is temporarily unavailable');
      throw e;
    }
  }
}
