import type { Member } from '../domain/member';
import type { MemberRepository } from '../domain/member-repository';

export class InMemoryMemberRepository implements MemberRepository {
  constructor(private readonly members: Member[]) {}

  findGoldEligible(): Member[] {
    return this.members.filter((m) => m.currentTier === 'standard' && m.annualSpend >= 1000 && m.yearsActive >= 2);
  }
}
