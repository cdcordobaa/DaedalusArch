/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  /** Takes the seats for the holder if enough are left; returns whether they were taken. */
  takeSeats(sailingId: string, holder: string, seats: number): boolean;
}
