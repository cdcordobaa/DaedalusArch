/** Asks whether a guest's payment is held on their card, ready for us to take. */
export interface Payments {
  isHeld(paymentId: string): Promise<boolean>;
}
