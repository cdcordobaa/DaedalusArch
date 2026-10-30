import type { ChargeOutcome } from '../in/ChargeStatus';

/** A charge just made on a direct debit. */
export interface Collection {
  readonly paymentId: string;
  readonly outcome: ChargeOutcome;
}

/** Direct debit charges, in the application's own terms; amounts in euros. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  collect(mandateId: string, amount: number): Promise<Collection>;
}
