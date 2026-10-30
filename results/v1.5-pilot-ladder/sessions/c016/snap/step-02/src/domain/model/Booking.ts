/** A pitch booked for a number of nights; the total is in euros. */
export interface Booking {
  readonly bookingId: string;
  readonly pitch: string;
  readonly nights: number;
  readonly total: number;
  readonly paymentId: string;
  /** What the guest paid online when booking, in euros. */
  readonly deposit: number;
  readonly state: 'confirmed' | 'checked_in' | 'cancelled';
}
