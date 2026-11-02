import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface CollectResult {
  readonly paymentId: string;
  readonly taken: boolean;
}

export interface Charges {
  /** Collects an amount (in euros) on a mandate. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<CollectResult>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
