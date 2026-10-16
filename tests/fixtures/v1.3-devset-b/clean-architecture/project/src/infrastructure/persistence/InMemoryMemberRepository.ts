import { Member } from '../../domain/entities/Member';
import { MemberRepository } from '../../domain/repositories/MemberRepository';

export class InMemoryMemberRepository implements MemberRepository {
  private readonly rows = new Map<string, Member>();

  async findById(id: string): Promise<Member | undefined> {
    return this.rows.get(id);
  }

  async save(member: Member): Promise<void> {
    this.rows.set(member.id, member);
  }
}
