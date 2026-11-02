export interface RedemptionOutcome {
  readonly result: 'accepted' | 'insufficient_balance' | 'voucher_blocked';
  /** Euros still missing when the balance is insufficient. */
  readonly shortBy: number;
}

export interface VoucherRedemptions {
  /** Amounts are in euros. */
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
