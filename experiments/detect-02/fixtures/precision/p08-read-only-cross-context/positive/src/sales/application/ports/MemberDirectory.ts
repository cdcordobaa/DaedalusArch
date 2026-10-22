export interface MemberDirectory {
  tierOf(memberId: string): string;
  award(memberId: string, points: number): void;
}
