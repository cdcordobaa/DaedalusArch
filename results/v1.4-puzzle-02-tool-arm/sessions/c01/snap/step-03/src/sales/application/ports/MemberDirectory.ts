/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** The member's tier as shown on their member card, or undefined for an unknown member. */
  tierOf(memberId: string): string | undefined;
  awardPoints(memberId: string, points: number): void;
}
