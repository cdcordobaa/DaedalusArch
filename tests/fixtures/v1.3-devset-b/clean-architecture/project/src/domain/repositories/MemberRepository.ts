import { Member } from '../entities/Member';

export interface MemberRepository {
  findById(id: string): Promise<Member | undefined>;
  save(member: Member): Promise<void>;
}
