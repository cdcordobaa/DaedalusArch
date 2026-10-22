/** Lets the sales side credit loyalty points to a member's card. */
export interface MemberPoints {
  award(memberId: string, points: number): void;
}
