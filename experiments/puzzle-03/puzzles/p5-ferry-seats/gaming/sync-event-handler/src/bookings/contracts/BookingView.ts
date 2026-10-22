/** What other parts of the system may know about a booking. */
export interface BookingView {
  readonly id: string;
  readonly passenger: string;
  readonly sailingId: string;
  readonly seats: number;
  readonly status: string;
}
