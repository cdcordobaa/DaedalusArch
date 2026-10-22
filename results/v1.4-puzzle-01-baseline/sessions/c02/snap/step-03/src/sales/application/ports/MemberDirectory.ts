/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percentage taken off every order for this member. */
  discountPercent(memberId: string): number;
  /** Puts points on the member's card straight away. */
  award(memberId: string, points: number): void;
}
