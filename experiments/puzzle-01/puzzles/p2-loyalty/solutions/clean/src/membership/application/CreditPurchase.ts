import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

export class CreditPurchase {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, orderId: string, paidCents: number): void {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) return;
    member.creditPurchase(orderId, paidCents);
    this.members.save(member);
  }
}
