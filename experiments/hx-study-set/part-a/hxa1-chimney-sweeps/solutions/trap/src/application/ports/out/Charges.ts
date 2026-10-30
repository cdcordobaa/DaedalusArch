import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Charges {
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
