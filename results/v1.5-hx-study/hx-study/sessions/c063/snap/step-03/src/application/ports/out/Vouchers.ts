import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export type Redemption =
  | { readonly result: 'accepted' }
  | { readonly result: 'insufficient_balance'; readonly shortBy: number }
  | { readonly result: 'voucher_blocked' };

export interface Vouchers {
  /** Amounts are in euros. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
  find(code: string): Promise<VoucherRecord>;
}
