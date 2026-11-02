// A domain summary that declares three of the carrier's reply fields beside two of its own.
export interface BookingSummary {
  readonly reference: string;
  readonly booking_state: string;
  readonly freight_charge: number;
  readonly fuel_surcharge: number;
  readonly note: string;
}
