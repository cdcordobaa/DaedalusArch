/** What this part of the system needs to know about club members. */
export interface MemberDirectory {
  exists(memberId: string): boolean;
  pointsOf(memberId: string): number;
  addPoints(memberId: string, points: number): void;
}
