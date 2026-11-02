/** A passenger's place in the basket; the voucher value is in euros, as it stood when the seat was given. */
export interface Seat {
  readonly passenger: string;
  readonly voucherCode: string;
  readonly voucherValue: number;
  readonly state: 'booked' | 'aboard';
}

/** One balloon flight on one day (YYYY-MM-DD). */
export interface Flight {
  readonly flightId: string;
  readonly day: string;
  readonly seats: readonly Seat[];
}
