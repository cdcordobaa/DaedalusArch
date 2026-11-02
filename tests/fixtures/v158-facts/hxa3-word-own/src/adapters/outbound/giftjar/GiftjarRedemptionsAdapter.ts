import type { GiftjarClient } from 'giftjar-sdk';
import type { Redemption, VoucherRedemptions } from '../../../application/ports/out/VoucherRedemptions';

export class GiftjarRedemptionsAdapter implements VoucherRedemptions {
  constructor(private readonly client: GiftjarClient) {}

  async redeem(code: string, amount: number, reference: string): Promise<Redemption> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    if (r.result === 'accepted') return { outcome: 'paid' };
    if (r.result === 'insufficient_balance') return { outcome: 'short', shortBy: r.short_by_cents / 100 };
    return { outcome: 'refused' };
  }
}
