import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export type ChargeRequest = { mandateId: string; amountCents: number; description: string };
export type ChargeCreated = { paymentId: string; failed: boolean };

export interface Charges {
  create(request: ChargeRequest): Promise<ChargeCreated>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
