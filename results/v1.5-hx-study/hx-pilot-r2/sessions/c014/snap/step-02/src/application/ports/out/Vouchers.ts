import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export interface Redemption {
  readonly result: 'accepted' | 'insufficient_balance' | 'voucher_blocked';
  /** Euros still missing when the balance was insufficient. */
  readonly shortBy: number;
}

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems an amount in euros from the voucher. */
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
