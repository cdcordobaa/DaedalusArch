/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  isCancelled(sailingId: string): boolean;
  /** Takes the seats for the holder if enough are left; true when taken, false when nothing was taken. */
  takeSeats(sailingId: string, holder: string, seats: number): boolean;
  /** Gives back the seats taken for the holder. */
  returnSeats(sailingId: string, holder: string): void;
}
