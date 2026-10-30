import type { GiftjarClient } from 'giftjar-sdk';
import type { VoucherRecord } from '../../../domain/model/VoucherRecord';
import type { Vouchers, VoucherRedemption } from '../../../application/ports/out/Vouchers';

export class GiftjarVouchersAdapter implements Vouchers {
  constructor(private readonly client: GiftjarClient) {}

  async find(code: string): Promise<VoucherRecord> {
    const v = await this.client.lookup(code);
    const usableForFlight = v.status === 'activated' || v.status === 'partially_redeemed';
    return { code: v.code, balance: v.balance_cents / 100, providerStatus: v.status, usableForFlight };
  }

  async redeem(code: string, amount: number, reference: string): Promise<VoucherRedemption> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    return { result: r.result, shortBy: r.short_by_cents / 100 };
  }
}
