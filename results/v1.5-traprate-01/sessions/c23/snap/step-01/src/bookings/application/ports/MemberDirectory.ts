/** What class bookings need to know about gym members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percentage taken off every booking by this member; 0 when there is no discount. */
  discountPercent(memberId: string): number;
}
