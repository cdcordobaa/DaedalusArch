/** The outcome of taking a held payment: the amount taken in euros, or not taken at all. */
export type CaptureResult = { readonly taken: true; readonly amount: number } | { readonly taken: false };

/** Asks the payment provider about a guest's payment, in the application's own terms. */
export interface Payments {
  /** True only when the money is held on the guest's card, ready for us to take. */
  isHeld(paymentId: string): Promise<boolean>;
  /** Takes the held money. Not taken when the hold was called off or ran out. */
  capture(paymentId: string): Promise<CaptureResult>;
}
