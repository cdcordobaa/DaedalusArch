import type { ChargeOutcome } from '../in/ChargeStatus';

export interface CollectionResult {
  readonly paymentId: string;
  /** False when the bank side refused the debit (e.g. the household cancelled the mandate). */
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. */
export interface Charges {
  /** Collects an amount in euros on a mandate. */
  collect(mandateId: string, amount: number, description: string): Promise<CollectionResult>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
