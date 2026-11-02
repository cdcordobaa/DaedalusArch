import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

/** Outcome of redeeming an amount (euros) from a voucher; `shortBy` is the euros still missing. */
export interface RedemptionOutcome {
  readonly result: 'paid' | 'short' | 'refused';
  readonly shortBy: number;
}

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
