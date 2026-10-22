/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  isCancelled(sailingId: string): boolean;
  /** Takes seats on the sailing for a booking; false (and nothing taken) when there are not enough. */
  takeSeats(sailingId: string, bookingId: string, seats: number): boolean;
  /** Gives back the seats a booking took. */
  releaseSeats(sailingId: string, bookingId: string): void;
}
