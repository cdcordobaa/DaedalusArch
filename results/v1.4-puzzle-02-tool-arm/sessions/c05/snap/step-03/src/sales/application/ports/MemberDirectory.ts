/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percentage taken off every order of this member (0 when they have no discount). */
  discountPercent(memberId: string): number;
  /** Puts loyalty points on the member's card. */
  awardPoints(memberId: string, points: number): void;
}
