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
  suspend(memberId: string, reason: string): void {
    const member = this.require(memberId);
    if (member.suspended) return;
    this.members.update({ ...member, suspended: true, notices: [...member.notices, `Your borrowing is suspended: ${reason}.`] });
  }

  reinstate(memberId: string): void {
    const member = this.require(memberId);
    if (!member.suspended) return;
    this.members.update({ ...member, suspended: false, notices: [...member.notices, 'Your borrowing is open again.'] });
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
