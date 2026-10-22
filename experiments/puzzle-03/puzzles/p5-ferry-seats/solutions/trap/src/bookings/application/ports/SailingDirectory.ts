/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  isCancelled(sailingId: string): boolean;
  holdSeats(sailingId: string, holder: string, seats: number): void;
  releaseSeats(sailingId: string, holder: string): void;
}
