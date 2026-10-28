import { MemberRepository } from '../../../application/ports/out/member-repository.port';
import { Member } from '../../../domain/member';
import { MemoryDb } from './memory-db';

export class InMemoryMemberRepository implements MemberRepository {
  constructor(private readonly db: MemoryDb) {}
  async findById(id: string): Promise<Member | null> {
    return this.db.members.get(id) ?? null;
  }
  async save(member: Member): Promise<void> {
    this.db.members.set(member.id, member);
  }
}
