import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

/** One point per whole currency unit paid; amounts under one unit earn nothing. */
export class EarnPointsFromPurchase {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, paidCents: number): void {
    const points = Math.floor(paidCents / 100);
    if (points <= 0) return;
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) throw new Error(`no member ${memberId}`);
    member.award(points);
    this.members.save(member);
  }
}
