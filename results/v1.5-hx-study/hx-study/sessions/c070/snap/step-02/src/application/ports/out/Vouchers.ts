import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of redeeming an amount; `shortBy` is in euros. */
export interface Redemption {
  readonly result: 'accepted' | 'insufficient_balance' | 'voucher_blocked';
  readonly shortBy: number;
}

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems `amount` euros from the voucher. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
