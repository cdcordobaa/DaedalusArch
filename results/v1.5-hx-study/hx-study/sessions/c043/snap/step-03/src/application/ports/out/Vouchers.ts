import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of redeeming part of a voucher; amounts are in euros. */
export interface Redemption {
  readonly result: 'paid' | 'short' | 'unusable';
  /** Euros still to pay (above zero only when the balance was insufficient). */
  readonly shortBy: number;
}

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
