/** Either the money was taken (amount in euros), or the payment can no longer be captured (canceled, authorisation expired). */
export type CaptureResult =
  | { readonly captured: true; readonly amount: number }
  | { readonly captured: false };

export interface PaymentCapture {
  capture(paymentId: string): Promise<CaptureResult>;
  /** Calls off the payment so the money held on the guest's card is given back. */
  release(paymentId: string): Promise<void>;
}
