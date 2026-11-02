import type { GiftjarClient } from 'giftjar-sdk';
import type { RedemptionOutcome, VoucherRedemptions } from '../../../application/ports/out/VoucherRedemptions';

export class GiftjarRedemptionsAdapter implements VoucherRedemptions {
  constructor(private readonly client: GiftjarClient) {}

  async redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    return { result: r.result, shortBy: r.short_by_cents / 100 };
  }
}
