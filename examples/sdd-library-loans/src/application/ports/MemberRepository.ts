import type { Email } from '../../domain/membership/Email';
import type { Member } from '../../domain/membership/Member';

/** Outbound port: where members are kept. */
export interface MemberRepository {
  nextId(): Promise<string>;
  save(member: Member): Promise<void>;
  findById(id: string): Promise<Member | undefined>;
  findByEmail(email: Email): Promise<Member | undefined>;
}
