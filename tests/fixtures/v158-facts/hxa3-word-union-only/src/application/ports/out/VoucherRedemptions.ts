/** Taking an amount from a voucher, in the application's terms (one vendor value kept: accepted). */
export type Redemption =
  | { readonly outcome: 'accepted' }
  | { readonly outcome: 'short'; readonly shortBy: number }
  | { readonly outcome: 'refused' };

export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
