/** What class bookings need to know about gym members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
}
