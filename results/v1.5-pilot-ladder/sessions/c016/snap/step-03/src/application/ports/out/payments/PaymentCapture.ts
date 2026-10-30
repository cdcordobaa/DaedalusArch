/** Outcome of taking the money held on a payment, amounts in euros. */
export type CaptureResult =
  | { readonly outcome: 'captured'; readonly amountReceived: number }
  | { readonly outcome: 'canceled' };

export interface PaymentCapture {
  capture(paymentId: string): Promise<CaptureResult>;
}
