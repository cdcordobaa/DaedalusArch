/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  /** Takes the seats for the holder if the sailing has enough left; false (nothing taken) if not. */
  takeSeats(sailingId: string, holder: string, seats: number): boolean;
}
