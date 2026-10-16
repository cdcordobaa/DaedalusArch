import type { Member } from '../../domain/member';

export interface MemberRepository {
  findById(id: string): Promise<Member | undefined>;
  save(member: Member): Promise<void>;
}
