import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Collection {
  readonly paymentId: string;
  readonly outcome: ChargeOutcome;
}

export interface Charges {
  /** Collects an amount (in euros) on the mandate. */
  collect(mandateId: string, euros: number, description: string): Promise<Collection>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
