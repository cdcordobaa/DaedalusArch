import { Member } from '../../../domain/member';

export interface MemberRepository {
  findById(id: string): Promise<Member | null>;
  save(member: Member): Promise<void>;
}
