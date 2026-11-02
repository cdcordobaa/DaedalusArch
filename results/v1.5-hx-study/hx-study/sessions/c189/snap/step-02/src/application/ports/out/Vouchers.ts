import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export interface RedemptionOutcome {
  readonly result: 'accepted' | 'insufficient_balance' | 'voucher_blocked';
  /** Euros still missing when the balance was insufficient, otherwise 0. */
  readonly shortBy: number;
}

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  /** Redeems an amount in euros against the voucher; reference identifies the purpose. */
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
