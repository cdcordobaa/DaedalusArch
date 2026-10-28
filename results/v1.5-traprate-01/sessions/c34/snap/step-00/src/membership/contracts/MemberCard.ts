/** What other parts of the system may know about a gym member. */
export interface MemberCard {
  readonly memberId: string;
  readonly name: string;
  readonly visits: number;
  readonly level: string;
}
