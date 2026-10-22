import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

/** Staff award points by hand (complaints, promotions). */
export class AwardPoints {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, points: number): void {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) throw new Error(`no member ${memberId}`);
    member.award(points);
    this.members.save(member);
  }
}
