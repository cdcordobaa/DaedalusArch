import type { ChargeOutcome } from '../in/ChargeStatus';

/** The result of asking for a payment on a mandate. */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. Amounts are in euros. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amountEuros: number, description: string): Promise<Collection>;
}
