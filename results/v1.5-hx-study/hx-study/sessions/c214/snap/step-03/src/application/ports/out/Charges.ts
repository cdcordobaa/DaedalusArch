import type { ChargeOutcome } from '../in/ChargeStatus';

/** A fee to collect by direct debit; the amount is in euros. */
export interface ChargeRequest {
  readonly mandateId: string;
  readonly amount: number;
  readonly description: string;
}

/** What came of asking for a charge: the payment's id and whether the bank side took it on. */
export interface ChargeReceipt {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Direct debit charges, in the application's own terms. */
export interface Charges {
  collect(request: ChargeRequest): Promise<ChargeReceipt>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
