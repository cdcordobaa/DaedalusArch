import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Charges {
  /** Collects an amount in euros on a mandate. */
  collect(mandateId: string, euros: number, description: string): Promise<{ paymentId: string; failed: boolean }>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
