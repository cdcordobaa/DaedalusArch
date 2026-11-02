import type { ChargeOutcome } from '../in/ChargeStatus';

export interface CollectionResult {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. Amounts are in euros. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amountEuros: number, description: string): Promise<CollectionResult>;
}
