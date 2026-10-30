/** The outcome of taking a held payment; the amount is in euros. */
export type CaptureResult = { readonly taken: true; readonly amount: number } | { readonly taken: false };

/** Asks whether a guest's payment is held on their card, ready for us to take, and takes it. */
export interface Payments {
  isHeld(paymentId: string): Promise<boolean>;
  capture(paymentId: string): Promise<CaptureResult>;
  /** Calls off the hold so the money goes back to the guest's card. */
  release(paymentId: string): Promise<void>;
}
