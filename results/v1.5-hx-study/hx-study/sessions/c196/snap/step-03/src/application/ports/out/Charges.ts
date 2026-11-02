import type { ChargeOutcome } from '../in/ChargeStatus';

/** Result of asking for a payment: whether the bank side took it on, and its id. */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms (amounts in euros). */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amountEuros: number, description: string): Promise<Collection>;
}
