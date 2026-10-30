/** The outcome of taking the money of an authorised payment; amounts are in euros. */
export type CaptureResult =
  | { readonly captured: true; readonly amount: number }
  | { readonly captured: false };

export interface PaymentCaptures {
  capture(paymentId: string): Promise<CaptureResult>;
  /** Calls off an authorised payment that was not captured, so the hold on the card is given back. */
  release(paymentId: string): Promise<void>;
}
