import type { ChargeOutcome } from '../in/ChargeStatus';

/** The result of asking for a new collection: taken on, or failed (e.g. the mandate was cancelled). */
export interface Collection {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
  /** Collect `fee` euros on the mandate. */
  collect(mandateId: string, fee: number, description: string): Promise<Collection>;
}
