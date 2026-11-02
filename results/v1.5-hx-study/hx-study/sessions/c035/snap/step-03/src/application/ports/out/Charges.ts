import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface ChargeRequest {
  readonly mandateId: string;
  /** Amount in euros. */
  readonly amount: number;
  readonly description: string;
}

export interface ChargeReceipt {
  readonly paymentId: string;
  readonly accepted: boolean;
}

export interface Charges {
  create(request: ChargeRequest): Promise<ChargeReceipt>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
