import type { GiftjarClient } from 'giftjar-sdk';
import type { VoucherRecord } from '../../../domain/model/VoucherRecord';
import type { Vouchers } from '../../../application/ports/out/Vouchers';

export class GiftjarVouchersAdapter implements Vouchers {
  constructor(private readonly client: GiftjarClient) {}

  async find(code: string): Promise<VoucherRecord> {
    const v = await this.client.lookup(code);
    const usableForFlight = v.status === 'activated' || v.status === 'partially_redeemed';
    return { code: v.code, balance: v.balance_cents / 100, providerStatus: v.status, usableForFlight };
  }
}
