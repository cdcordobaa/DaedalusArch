/** What table reservations need to know about guests. */
export interface GuestDirectory {
  exists(guestId: string): boolean;
}
