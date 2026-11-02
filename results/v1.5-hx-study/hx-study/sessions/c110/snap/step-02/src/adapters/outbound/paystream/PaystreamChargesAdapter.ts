import { PaystreamUnavailableError } from 'paystream-sdk';
import type { PaystreamClient } from 'paystream-sdk';
import type { ChargeReceipt, Charges } from '../../../application/ports/out/Charges';
import { PaymentProviderUnavailableError } from '../../../domain/errors/PaymentError';
import { Money } from '../../../domain/model/Money';

export class PaystreamChargesAdapter implements Charges {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt> {
    try {
      const charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: orderId,
      });
      return {
        chargeId: charge.chargeId,
        approved: charge.state === 'SUCCEEDED',
        declineReason: charge.declineCode,
        amount: Money.ofCents(charge.amountMinor, charge.currency),
      };
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentProviderUnavailableError('the payment provider is unavailable, please try again');
      throw e;
    }
  }
}
