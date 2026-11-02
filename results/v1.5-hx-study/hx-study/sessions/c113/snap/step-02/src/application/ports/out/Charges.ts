import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface CollectionResult {
  readonly accepted: boolean;
  readonly paymentId: string;
}

export interface Charges {
  /** Collect an amount (in euros) on a mandate. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<CollectionResult>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
