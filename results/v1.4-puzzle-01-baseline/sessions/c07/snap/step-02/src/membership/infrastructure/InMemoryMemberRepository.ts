import { Member, type MemberState } from '../domain/member/Member';
import type { MemberRepository } from '../domain/member/MemberRepository';
import { MemberId } from '../domain/member/value-objects/MemberId';

export class InMemoryMemberRepository implements MemberRepository {
  private readonly rows = new Map<string, MemberState>();
  private sequence = 0;

  nextId(): MemberId {
    this.sequence += 1;
    return MemberId.of(`M-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: MemberId): Member | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : Member.restore(row);
  }

  save(member: Member): void {
    this.rows.set(member.id.value, member.state());
  }
}
