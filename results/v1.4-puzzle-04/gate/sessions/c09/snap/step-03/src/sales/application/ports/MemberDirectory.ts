/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** Percentage taken off every order for this member. */
  discountPercent(memberId: string): number;
  /** Credits loyalty points to the member's card. */
  awardPoints(memberId: string, points: number): void;
  /** The details shown on a receipt, or undefined for an unknown member. */
  describe(memberId: string): { readonly name: string; readonly points: number } | undefined;
}
