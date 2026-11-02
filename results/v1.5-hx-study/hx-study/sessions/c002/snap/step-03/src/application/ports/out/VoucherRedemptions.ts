export type Redemption =
  | { readonly result: 'paid' }
  | { readonly result: 'short'; readonly shortBy: number }
  | { readonly result: 'refused' };

/** Taking an amount (in euros) from a voucher, in the application's own terms. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
