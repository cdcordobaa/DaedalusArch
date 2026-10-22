import type { MemberRepository } from '../../membership/domain/member/MemberRepository';
import { MemberId } from '../../membership/domain/member/value-objects/MemberId';

/** The thank-you line at the bottom of a member's receipt. */
export class ReceiptFooter {
  constructor(private readonly members: MemberRepository) {}

  footerFor(memberId: string | null): string {
    if (memberId === null) return 'Thank you for shopping with us.';
    const member = this.members.byId(MemberId.of(memberId));
    return member === undefined ? 'Thank you.' : `Thank you, ${member.name}: you have ${String(member.points)} points.`;
  }
}
