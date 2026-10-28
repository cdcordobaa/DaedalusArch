import type { MemberRepository } from '../../membership/domain/member/MemberRepository';
import { MemberId } from '../../membership/domain/member/value-objects/MemberId';

/** The closing line of a member's booking confirmation. */
export class ConfirmationNote {
  constructor(private readonly members: MemberRepository) {}

  noteFor(memberId: string | null): string {
    if (memberId === null) return 'Enjoy your drop-in class.';
    const member = this.members.byId(MemberId.of(memberId));
    return member === undefined ? 'See you in class.' : `See you in class, ${member.name}: you have ${String(member.visits)} visits.`;
  }
}
