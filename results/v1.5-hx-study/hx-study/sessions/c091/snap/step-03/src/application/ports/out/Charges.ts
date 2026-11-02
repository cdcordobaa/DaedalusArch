import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface CollectedPayment {
  readonly paymentId: string;
  readonly failed: boolean;
}

export interface Charges {
  /** Creates a payment on the mandate; the amount is in cents. */
  collect(mandateId: string, cents: number, description: string): Promise<CollectedPayment>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
