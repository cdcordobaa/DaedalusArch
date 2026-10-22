import type { Member } from './Member';
import type { MemberId } from './value-objects/MemberId';

export interface MemberRepository {
  nextId(): MemberId;
  byId(id: MemberId): Member | undefined;
  save(member: Member): void;
}
