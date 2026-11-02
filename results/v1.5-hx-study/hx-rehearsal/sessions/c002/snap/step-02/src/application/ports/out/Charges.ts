import type { ChargeOutcome } from '../in/ChargeStatus';

export interface CollectResult {
  readonly paymentId: string;
  /** False when the provider reports the collection as failed. */
  readonly taken: boolean;
}

/** Direct debit charges, in the application's own terms. */
export interface Charges {
  /** Collects an amount (in euros) on a mandate. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<CollectResult>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
