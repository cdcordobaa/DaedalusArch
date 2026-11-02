export interface CheckoutRequest {
  readonly orderId: string;
  readonly total: number;
  readonly currency: string;
  /** The card token from the payment form. */
  readonly cardToken: string;
}

export interface CheckoutView {
  readonly orderId: string;
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  /** Absent when the card was declined. */
  readonly reference?: string;
  /** Customer-facing explanation, set when status is 'declined'. */
  readonly message?: string;
}

export interface Checkout {
  checkout(request: CheckoutRequest): Promise<CheckoutView>;
}
