import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

/** The front desk adds visits by hand (open-gym check-ins, corrections). */
export class AddVisits {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, visits: number): void {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) throw new Error(`no member ${memberId}`);
    member.addVisits(visits);
    this.members.save(member);
  }
}
