/** The result of asking for a fee to be collected by direct debit. */
export interface FeeCollectionResult {
  readonly paymentId: string;
  /** true when the payment was taken on; false when the collection failed. */
  readonly accepted: boolean;
}

/** Collects fees by direct debit; amounts are in euros. */
export interface FeeCollection {
  collect(mandateId: string, amountEuros: number, description: string): Promise<FeeCollectionResult>;
}
