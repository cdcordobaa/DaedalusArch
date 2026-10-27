/** What other parts of the system may know about a guest. */
export interface GuestProfile {
  readonly guestId: string;
  readonly name: string;
  readonly visits: number;
  readonly status: string;
}
