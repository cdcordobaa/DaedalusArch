import type { MemberRepository } from '../../application/ports/member-repository';
import type { Member } from '../../domain/member';

export class InMemoryMemberRepository implements MemberRepository {
  private readonly rows = new Map<string, Member>();

  async findById(id: string): Promise<Member | undefined> {
    return this.rows.get(id);
  }

  async save(member: Member): Promise<void> {
    this.rows.set(member.id, member);
  }
}
