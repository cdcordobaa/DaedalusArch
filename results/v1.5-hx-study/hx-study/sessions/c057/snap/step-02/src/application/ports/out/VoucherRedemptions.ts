/** Result of charging an amount (in euros) to a voucher, in the application's own terms. */
export type RedemptionOutcome =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'balance_short'; readonly due: number }
  | { readonly kind: 'refused' };

/** Paying for something with a voucher. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<RedemptionOutcome>;
}
