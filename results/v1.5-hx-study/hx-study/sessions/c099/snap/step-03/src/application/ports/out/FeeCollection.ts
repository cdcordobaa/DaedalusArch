export interface FeeCollected {
  readonly paymentId: string;
  readonly accepted: boolean;
}

/** Collects a fee by direct debit on a mandate, in the application's own terms (euros). */
export interface FeeCollection {
  collect(mandateId: string, feeEuros: number, description: string): Promise<FeeCollected>;
}
