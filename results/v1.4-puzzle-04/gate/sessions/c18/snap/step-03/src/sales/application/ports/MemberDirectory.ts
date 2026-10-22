/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** The member's current tier, as shown on their member card. */
  tier(memberId: string): string | undefined;}
