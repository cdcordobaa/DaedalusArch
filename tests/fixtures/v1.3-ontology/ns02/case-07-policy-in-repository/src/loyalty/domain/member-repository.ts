import type { Member } from './member';

export interface MemberRepository {
  findGoldEligible(): Member[];
}
