/** What class bookings need to know about gym members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** The member's level as shown on their member card, or undefined for an unknown member. */
  levelOf(memberId: string): string | undefined;
}
