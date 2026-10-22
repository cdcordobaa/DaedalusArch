/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  /** Takes the seats for the holder if the sailing has enough left; says whether it did. */
  take(sailingId: string, holder: string, seats: number): boolean;
  /** Gives back the seats the holder took. */
  release(sailingId: string, holder: string): void;
}
