import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

export interface Charges {
  /** Collects an amount (in cents) on a mandate. */
  collect(mandateId: string, amountCents: number, description: string): Promise<Collection>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
