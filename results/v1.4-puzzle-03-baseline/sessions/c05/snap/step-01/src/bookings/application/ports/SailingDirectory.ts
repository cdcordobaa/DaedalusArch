/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  /** Takes the seats if all are available; takes nothing otherwise. */
  takeSeats(sailingId: string, bookingId: string, seats: number): boolean;
}
