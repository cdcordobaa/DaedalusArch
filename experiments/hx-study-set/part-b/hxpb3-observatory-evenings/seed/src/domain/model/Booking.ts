/** Seats held for a party on one evening. */
export interface Booking {
  readonly bookingRef: string;
  readonly evening: string;
  readonly adults: number;
  readonly children: number;
  /** Euros. */
  readonly priceEuros: number;
}
