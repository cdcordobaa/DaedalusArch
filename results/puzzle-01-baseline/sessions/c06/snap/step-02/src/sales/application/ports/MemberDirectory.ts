/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  /** The member's tier name, or undefined when there is no such member. */
  tierOf(memberId: string): string | undefined;
}
