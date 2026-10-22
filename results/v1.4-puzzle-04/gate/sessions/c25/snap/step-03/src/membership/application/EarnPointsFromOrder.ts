import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

/** A member's placed order earns points. */
export class EarnPointsFromOrder {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, orderId: string, paidCents: number): void {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) throw new Error(`no member ${memberId}`);
    member.earnFromOrder(orderId, paidCents);
    this.members.save(member);
  }
}
