/** Asks the payment provider about a guest's payment, in the application's own terms. */
export interface Payments {
  /** True only when the money is held on the guest's card, ready for us to take. */
  isHeld(paymentId: string): Promise<boolean>;
}
