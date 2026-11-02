import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export type Redemption =
  | { readonly result: 'accepted' }
  | { readonly result: 'insufficient_balance'; readonly shortBy: number }
  | { readonly result: 'blocked' };

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems an amount in euros; shortBy is in euros. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
