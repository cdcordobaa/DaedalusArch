/** What other parts of the system may know about a member. */
export interface MemberCard {
  readonly memberId: string;
  readonly name: string;
  readonly points: number;
  readonly tier: string;
}
