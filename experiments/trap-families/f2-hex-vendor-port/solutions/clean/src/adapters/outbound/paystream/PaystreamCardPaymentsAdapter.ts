import { PaystreamUnavailableError, type PaystreamCharge, type PaystreamClient } from 'paystream-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';
import { PaymentsUnavailable } from '../../../domain/errors/PaymentsUnavailable';
import type { CardCharge, DeclineReason } from '../../../domain/model/CardCharge';
import type { Money } from '../../../domain/model/Money';
import type { Order } from '../../../domain/model/Order';

const REASONS: Partial<Record<NonNullable<PaystreamCharge['declineCode']>, DeclineReason>> = {
  insufficient_funds: 'not-enough-funds',
  expired_card: 'card-expired',
};

export class PaystreamCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: PaystreamClient) {}

  async charge(order: Order, amount: Money, cardToken: string): Promise<CardCharge> {
    let charge: PaystreamCharge;
    try {
      charge = await this.client.charge({
        amountMinor: amount.cents,
        currency: amount.currency,
        source: { token: cardToken },
        captureMethod: 'automatic',
        merchantReference: order.id,
      });
    } catch (e) {
      if (e instanceof PaystreamUnavailableError) throw new PaymentsUnavailable(e.message);
      throw e;
    }
    if (charge.state === 'SUCCEEDED') return { outcome: 'accepted', reference: charge.chargeId };
    return { outcome: 'refused', reason: (charge.declineCode === undefined ? undefined : REASONS[charge.declineCode]) ?? 'other' };
  }
}
