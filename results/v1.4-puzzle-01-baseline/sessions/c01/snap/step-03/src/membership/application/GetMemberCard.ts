import type { MemberCard } from '../contracts/MemberCard';
import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

export class GetMemberCard {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string): MemberCard | undefined {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) return undefined;
    return { memberId: member.id.value, name: member.name, points: member.points, tier: member.tier() };
  }
}
