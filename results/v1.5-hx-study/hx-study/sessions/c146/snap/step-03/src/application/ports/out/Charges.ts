import type { ChargeOutcome } from '../in/ChargeStatus';

/** The result of asking for a new charge: whether it was taken on, and the id of the payment. */
export interface ChargeRequestResult {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. Amounts are in euros. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amountEuros: number, description: string): Promise<ChargeRequestResult>;
}
