/** Either the money was taken (amount in euros), or the payment can no longer be captured (canceled, authorisation expired). */
export type CaptureResult =
  | { readonly captured: true; readonly amount: number }
  | { readonly captured: false };

export interface PaymentCapture {
  capture(paymentId: string): Promise<CaptureResult>;
}
