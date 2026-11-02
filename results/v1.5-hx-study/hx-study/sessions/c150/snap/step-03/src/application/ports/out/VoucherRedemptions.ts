export type RedemptionOutcome =
  | { readonly kind: 'paid' }
  | { readonly kind: 'short'; readonly shortBy: number }
  | { readonly kind: 'refused' };

/** Taking money off a voucher, in the application's own terms: amounts are in euros. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
