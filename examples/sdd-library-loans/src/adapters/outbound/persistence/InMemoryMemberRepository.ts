import type { MemberRepository } from '../../../application/ports/MemberRepository';
import type { Email } from '../../../domain/membership/Email';
import type { Member } from '../../../domain/membership/Member';

export class InMemoryMemberRepository implements MemberRepository {
  private readonly byId = new Map<string, Member>();
  private seq = 0;

  async nextId(): Promise<string> {
    this.seq += 1;
    return `m-${String(this.seq)}`;
  }

  async save(member: Member): Promise<void> {
    this.byId.set(member.id, member);
  }

  async findById(id: string): Promise<Member | undefined> {
    return this.byId.get(id);
  }

  async findByEmail(email: Email): Promise<Member | undefined> {
    return [...this.byId.values()].find((m) => m.email.value === email.value);
  }
}
