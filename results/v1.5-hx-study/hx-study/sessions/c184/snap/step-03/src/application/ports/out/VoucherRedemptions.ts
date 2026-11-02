/** The outcome of taking an amount (in euros) from a voucher, in the application's own terms. */
export type Redemption =
  | { readonly outcome: 'accepted' }
  | { readonly outcome: 'short'; readonly shortBy: number }
  | { readonly outcome: 'refused' };

/** Taking money from a voucher; the reference ties the payment to what it paid for. */
export interface VoucherRedemptions {
  redeem(code: string, amount: number, reference: string): Promise<Redemption>;
}
