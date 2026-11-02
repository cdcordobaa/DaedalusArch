import type { GiftjarClient } from 'giftjar-sdk';
import type { VoucherRecord } from '../../../domain/model/VoucherRecord';
import type { Redemption, Vouchers } from '../../../application/ports/out/Vouchers';

export class GiftjarVouchersAdapter implements Vouchers {
  constructor(private readonly client: GiftjarClient) {}

  async find(code: string): Promise<VoucherRecord> {
    const v = await this.client.lookup(code);
    const usableForFlight = v.status === 'activated' || v.status === 'partially_redeemed';
    return { code: v.code, balance: v.balance_cents / 100, providerStatus: v.status, usableForFlight };
  }

  async redeem(code: string, amount: number, reference: string): Promise<Redemption> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    if (r.result === 'accepted') return { result: 'paid' };
    if (r.result === 'insufficient_balance') return { result: 'balance_short', shortBy: r.short_by_cents / 100 };
    return { result: 'refused' };
  }
}
