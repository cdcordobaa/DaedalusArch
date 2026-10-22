import type { Member } from '../domain/member/Member';
import type { MemberRepository } from '../domain/member/MemberRepository';

export class InMemoryMemberRepository implements MemberRepository {
  private readonly rows = new Map<string, Member>();

  byId(id: string): Member | undefined {
    return this.rows.get(id);
  }

  save(member: Member): void {
    this.rows.set(member.id, member);
  }
}
