import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

export interface Charges {
  /** Collects an amount in euros from the mandate. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<Collection>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
