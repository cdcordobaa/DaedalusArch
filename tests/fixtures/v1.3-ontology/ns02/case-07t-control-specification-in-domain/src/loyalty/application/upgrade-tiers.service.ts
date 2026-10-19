import { GoldEligibility } from '../domain/gold-eligibility';
import type { MemberRepository } from '../domain/member-repository';

export class UpgradeTiersService {
  constructor(private readonly members: MemberRepository) {}

  run(): number {
    const eligible = this.members.findMatching(new GoldEligibility());
    for (const m of eligible) m.promoteToGold();
    return eligible.length;
  }
}
