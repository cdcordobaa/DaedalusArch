export interface Collection {
  readonly paymentId: string;
  readonly taken: boolean;
}

/** Collects a fee by direct debit on a mandate; the fee is in euros. */
export interface Collections {
  collect(mandateId: string, fee: number, description: string): Promise<Collection>;
}
