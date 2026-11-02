import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

export interface Charges {
  /** Collect an amount (in euros) on a mandate. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<Collection>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
