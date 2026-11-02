// A domain summary with its own field names, and one field renamed to the carrier's reply field confirmed_at.
export interface BookingSummary {
  readonly reference: string;
  readonly status: string;
  readonly chargeCents: number;
  readonly confirmed_at: string;
  readonly note: string;
}
