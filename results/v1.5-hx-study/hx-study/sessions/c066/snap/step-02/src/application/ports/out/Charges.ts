import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface NewCharge {
  readonly paymentId: string;
  readonly collectionFailed: boolean;
}

export interface Charges {
  /** Charges the mandate; the amount is in euros. */
  create(mandateId: string, amountEuros: number, description: string): Promise<NewCharge>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
