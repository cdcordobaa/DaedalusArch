import type { GiftjarClient } from 'giftjar-sdk';
import type { PaymentOutcome, VoucherPayments } from '../../../application/ports/out/VoucherPayments';

export class GiftjarPaymentsAdapter implements VoucherPayments {
  constructor(private readonly client: GiftjarClient) {}

  async pay(code: string, amount: number, reference: string): Promise<PaymentOutcome> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    if (r.result === 'accepted') return { kind: 'paid' };
    if (r.result === 'insufficient_balance') return { kind: 'short', due: r.short_by_cents / 100 };
    return { kind: 'refused' };
  }
}
