/** What came of paying an amount (euros) from a voucher, in the application's own terms. */
export type RedemptionOutcome =
  | { readonly result: 'paid' }
  | { readonly result: 'short'; readonly due: number }
  | { readonly result: 'unusable' };

export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
