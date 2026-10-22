import type { MemberCard } from '../contracts/MemberCard';
import type { MemberRepository } from '../domain/member/MemberRepository';

export class GetMemberCard {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string): MemberCard | undefined {
    const m = this.members.byId(memberId);
    return m === undefined ? undefined : { memberId: m.id, tier: m.tier };
  }
}
