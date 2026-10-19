import type { MemberRepository } from '../domain/member-repository';

export class UpgradeTiersService {
  constructor(private readonly members: MemberRepository) {}

  run(): number {
    const eligible = this.members.findGoldEligible();
    for (const m of eligible) m.promoteToGold();
    return eligible.length;
  }
}
