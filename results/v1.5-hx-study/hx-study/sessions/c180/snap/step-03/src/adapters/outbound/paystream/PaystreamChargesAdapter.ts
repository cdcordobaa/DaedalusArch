import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamCharge, PaystreamClient } from 'paystream-sdk';
import type { Charges } from '../../../application/ports/out/Charges';
import { PaymentDeclinedError, PaymentUnavailableError } from '../../../domain/errors/PaymentError';
import type { DeclineReason } from '../../../domain/errors/PaymentError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<{ readonly reference: string }> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError('the payment provider is unavailable, try again later');
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason: DeclineReason =
        charge.declineCode === 'insufficient_funds' ? 'InsufficientFunds' : charge.declineCode === 'expired_card' ? 'CardExpired' : 'Other';
      throw new PaymentDeclinedError(reason, `the card was declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { reference: charge.chargeId };
  }
}
