import type { Member } from './Member';

export interface MemberRepository {
  byId(id: string): Member | undefined;
  save(member: Member): void;
}
