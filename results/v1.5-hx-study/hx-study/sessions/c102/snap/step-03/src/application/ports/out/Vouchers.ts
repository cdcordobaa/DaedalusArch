import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of a redemption; amounts are in euros. */
export type Redemption =
  | { readonly result: 'accepted' }
  | { readonly result: 'insufficient_balance'; readonly shortBy: number }
  | { readonly result: 'voucher_blocked' };

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
