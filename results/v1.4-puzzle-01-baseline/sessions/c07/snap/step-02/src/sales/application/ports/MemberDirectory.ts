/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** The percentage taken off every order for this member (0 when none). */
  discountPercent(memberId: string): number;
}
