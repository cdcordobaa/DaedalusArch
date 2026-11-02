import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface CollectedCharge {
  readonly paymentId: string;
  readonly failed: boolean;
}

export interface Charges {
  /** Collect an amount (in euros) on a mandate. */
  collect(mandateId: string, euros: number, description: string): Promise<CollectedCharge>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
