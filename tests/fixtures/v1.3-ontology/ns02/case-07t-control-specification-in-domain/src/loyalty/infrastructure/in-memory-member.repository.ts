import type { Member } from '../domain/member';
import type { GoldEligibility } from '../domain/gold-eligibility';
import type { MemberRepository } from '../domain/member-repository';

export class InMemoryMemberRepository implements MemberRepository {
  constructor(private readonly members: Member[]) {}

  findMatching(spec: GoldEligibility): Member[] {
    return this.members.filter((m) => spec.isSatisfiedBy(m));
  }
}
