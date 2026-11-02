import { PaystreamUnavailableError, type PaystreamClient, type PaystreamCharge } from 'paystream-sdk';
import type { CardChargeResult, CardPayments } from '../../../application/ports/out/CardPayments';
import { CardDeclinedError, type CardDeclineReason } from '../../../domain/errors/CardDeclinedError';
import { PaymentUnavailableError } from '../../../domain/errors/PaymentUnavailableError';
import type { Money } from '../../../domain/model/Money';

export class PaystreamCardPayments implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult> {
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
      if (e instanceof PaystreamUnavailableError) throw new PaymentUnavailableError(e.message);
      throw e;
    }
    if (charge.state !== 'SUCCEEDED') {
      const reason: CardDeclineReason =
        charge.declineCode === 'insufficient_funds' ? 'insufficientFunds' : charge.declineCode === 'expired_card' ? 'cardExpired' : 'other';
      throw new CardDeclinedError(reason, `card payment declined${charge.declineCode ? `: ${charge.declineCode}` : ''}`);
    }
    return { reference: charge.chargeId };
  }
}
