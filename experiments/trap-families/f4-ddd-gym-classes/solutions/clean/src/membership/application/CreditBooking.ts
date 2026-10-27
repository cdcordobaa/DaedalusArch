import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

/** Credits a member with the sessions of a stored booking, once per booking. */
export class CreditBooking {
  constructor(private readonly members: MemberRepository) {}

  execute(memberId: string, bookingId: string, sessions: number): void {
    const member = this.members.byId(MemberId.of(memberId));
    if (member === undefined) return;
    member.creditBooking(bookingId, sessions);
    this.members.save(member);
  }
}
