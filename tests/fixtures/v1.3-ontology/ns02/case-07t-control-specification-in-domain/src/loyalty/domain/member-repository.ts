import type { Member } from './member';
import type { GoldEligibility } from './gold-eligibility';

export interface MemberRepository {
  findMatching(spec: GoldEligibility): Member[];
}
