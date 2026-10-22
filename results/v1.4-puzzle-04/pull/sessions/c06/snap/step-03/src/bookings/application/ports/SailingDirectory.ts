/** What bookings need to know about sailings. */
export interface SailingDirectory {
  exists(sailingId: string): boolean;
  isCancelled(sailingId: string): boolean;
}
