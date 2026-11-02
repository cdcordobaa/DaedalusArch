import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of redeeming a voucher; amounts are in euros. */
export type Redemption =
  | { readonly result: 'paid' }
  | { readonly result: 'short'; readonly shortBy: number }
  | { readonly result: 'blocked' };

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems an amount (euros) from the voucher; the reference identifies what it pays for. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
