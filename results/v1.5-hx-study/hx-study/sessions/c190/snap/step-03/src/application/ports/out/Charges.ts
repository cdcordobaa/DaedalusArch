import type { ChargeOutcome } from '../in/ChargeStatus';

/** The result of asking for a fee to be collected: taken on (with the charge's id) or failed. */
export type Collection =
  | { readonly taken: true; readonly paymentId: string }
  | { readonly taken: false };

/** Direct debit charges, in the application's own terms. Amounts are in euros. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amountEuros: number, description: string): Promise<Collection>;
}
