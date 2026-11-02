import type { ChargeOutcome } from '../in/ChargeStatus';

/** Direct debit charges already made, in the application's own terms. */
export interface Charges {
  /** Collects `amountEuros` on the mandate. `accepted` is false when the payment came back failed. */
  collect(mandateId: string, amountEuros: number, description: string): Promise<{ paymentId: string; accepted: boolean }>;
  outcome(paymentId: string): Promise<ChargeOutcome>;
}
