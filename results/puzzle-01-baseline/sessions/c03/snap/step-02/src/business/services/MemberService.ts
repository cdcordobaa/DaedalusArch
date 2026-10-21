import type { MemberGateway } from '../../persistence/MemberGateway';
import type { MemberRecord } from '../../persistence/records/MemberRecord';
import { LibraryError } from '../errors/LibraryError';

export class MemberService {
  constructor(private readonly members: MemberGateway) {}

  register(name: string): string {
    if (name.trim() === '') throw new LibraryError('a member needs a name');
    return this.members.insert(name).id;
  }

  isSuspended(memberId: string): boolean {
    return this.require(memberId).suspended;
  }

  /** Suspends a member (no new loans) and tells them why; suspending twice changes nothing. */
  suspend(memberId: string, reason: string, byStaff = true): void {
    const member = this.require(memberId);
    if (member.suspended) {
      // Staff taking over an automatic suspension makes it last until staff lift it.
      if (byStaff && !member.suspendedByStaff) this.members.update({ ...member, suspendedByStaff: true });
      return;
    }
    this.members.update({ ...member, suspended: true, suspendedByStaff: byStaff, notices: [...member.notices, `Your borrowing is suspended: ${reason}.`] });
  }

  reinstate(memberId: string): void {
    const member = this.require(memberId);
    if (!member.suspended) return;
    this.members.update({ ...member, suspended: false, suspendedByStaff: false, notices: [...member.notices, 'Your borrowing is open again.'] });
  }

  /** Reopens borrowing once the last overdue book is back, unless staff made the suspension. */
  reinstateAfterOverdue(memberId: string): void {
    const member = this.require(memberId);
    if (!member.suspended || member.suspendedByStaff) return;
    this.reinstate(memberId);
  }

  notices(memberId: string): string[] {
    return this.require(memberId).notices;
  }

  private require(memberId: string): MemberRecord {
    const member = this.members.byId(memberId);
    if (member === undefined) throw new LibraryError(`no member ${memberId}`);
    return member;
  }
}
