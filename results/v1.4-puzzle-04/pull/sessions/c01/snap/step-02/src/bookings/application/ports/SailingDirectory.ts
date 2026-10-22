/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  /** True when the seats were taken for the booking; false when the sailing has too few left. */
  takeSeats(sailingId: string, bookingId: string, seats: number): boolean;
  /** Gives back the seats taken for the booking. */
  releaseSeats(sailingId: string, bookingId: string): void;
}
