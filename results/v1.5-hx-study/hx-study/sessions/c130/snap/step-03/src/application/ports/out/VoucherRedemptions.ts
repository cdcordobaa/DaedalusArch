export type RedemptionOutcome =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'short_of_funds'; readonly shortBy: number }
  | { readonly kind: 'refused' };

/** Paying an amount (in euros) from a voucher, in the application's own terms. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
