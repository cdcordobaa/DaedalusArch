import type { GiftjarClient } from 'giftjar-sdk';
import type { VoucherRecord } from '../../../domain/model/VoucherRecord';
import type { Redemption, Vouchers }from '../../../application/ports/out/Vouchers';

export class GiftjarVouchersAdapter implements Vouchers {
  constructor(private readonly client: GiftjarClient) {}

  async find(code: string): Promise<VoucherRecord> {
    const v = await this.client.lookup(code);
    return { code: v.code, balance: v.balance_cents / 100, providerStatus: v.status };
  }

  async redeem(code: string, amount: number, reference: string): Promise<Redemption> {
    const r = await this.client.redeem({ code, amount_cents: Math.round(amount * 100), reference });
    switch (r.result) {
      case 'accepted':
        return { result: 'accepted' };
      case 'insufficient_balance':
        return { result: 'insufficient_balance', shortBy: r.short_by_cents / 100 };
      case 'voucher_blocked':
        return { result: 'voucher_blocked' };
    }
  }
}
