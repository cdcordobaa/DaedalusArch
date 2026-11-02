import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export type Redemption =
  | { readonly result: 'accepted' }
  | { readonly result: 'insufficient_balance'; /** euros still to pay */ readonly due: number }
  | { readonly result: 'blocked' };

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems an amount in euros from the voucher; the reference identifies the purchase. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
