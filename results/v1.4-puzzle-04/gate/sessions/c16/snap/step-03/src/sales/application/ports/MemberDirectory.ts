/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percentage taken off every order for this member's tier. */
  discountPercent(memberId: string): number;
  /** Adds loyalty points to the member's card. */
  awardPoints(memberId: string, points: number): void;
}
