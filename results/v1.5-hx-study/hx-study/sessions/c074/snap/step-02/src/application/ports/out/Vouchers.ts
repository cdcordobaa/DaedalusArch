import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of redeeming an amount (in euros) from a voucher. */
export type Redemption =
  | { readonly result: 'paid' }
  | { readonly result: 'balance_short'; readonly shortBy: number }
  | { readonly result: 'refused' };

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
