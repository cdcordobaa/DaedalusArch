/** The outcome of taking the money of an authorised payment; amounts are in euros. */
export type CaptureResult =
  | { readonly captured: true; readonly amount: number }
  | { readonly captured: false };

export interface PaymentCaptures {
  capture(paymentId: string): Promise<CaptureResult>;
}
