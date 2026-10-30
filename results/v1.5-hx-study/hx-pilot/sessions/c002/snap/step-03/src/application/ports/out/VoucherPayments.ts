/** What came of paying an amount from a voucher, in the application's own terms. Amounts are in euros. */
export type PaymentOutcome =
  | { readonly kind: 'paid' }
  | { readonly kind: 'short'; readonly due: number }
  | { readonly kind: 'refused' };

/** Paying from a voucher's balance. */
export interface VoucherPayments {
  pay(code: string, amount: number, reference: string): Promise<PaymentOutcome>;
}
