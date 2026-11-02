/** What came of asking the voucher company to take an amount off a voucher. Amounts are in euros. */
export type RedemptionOutcome =
  | { readonly kind: 'paid' }
  | { readonly kind: 'short'; readonly due: number }
  | { readonly kind: 'unusable' };

/** Taking money off a voucher, in the application's own terms. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
