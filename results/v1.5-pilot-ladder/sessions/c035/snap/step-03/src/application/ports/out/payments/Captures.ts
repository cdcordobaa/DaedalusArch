export type CaptureResult =
  | { readonly outcome: 'succeeded'; readonly amountReceived: number }
  | { readonly outcome: 'canceled' };

/** Taking the money of an authorised payment; amounts in euros. */
export interface Captures {
  capture(paymentId: string): Promise<CaptureResult>;
}
