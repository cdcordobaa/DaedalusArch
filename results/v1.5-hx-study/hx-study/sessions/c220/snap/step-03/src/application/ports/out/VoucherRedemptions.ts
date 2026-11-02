/** What the voucher company answered to a redemption, in the application's own terms (amounts in euros). */
export interface RedemptionOutcome {
  readonly result: 'paid' | 'short' | 'blocked';
  /** Euros still to pay; 0 unless the balance fell short. */
  readonly due: number;
}

export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
