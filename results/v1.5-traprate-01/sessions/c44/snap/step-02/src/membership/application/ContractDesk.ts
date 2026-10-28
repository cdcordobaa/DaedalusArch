import { MembershipError } from '../domain/MembershipError';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';
import type { PontoonLookup } from './ports/PontoonLookup';

const SEASON_FEE_PER_METRE = 150;

/** Seasonal berth contracts. */
export class ContractDesk {
  constructor(
    private readonly members: MembershipRepository,
    private readonly pontoons: PontoonLookup,
  ) {}

  stormClosed(pontoonId: string): void {
    for (const m of this.members.onPontoon(pontoonId)) {
      m.stormClose(pontoonId);
      this.members.put(m);
    }
  }

  signContract(memberId: string, pontoonId: string): void {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    if (!this.pontoons.exists(pontoonId)) throw new MembershipError(`no pontoon ${pontoonId}`);
    m.assertCanContract();
    const given = this.pontoons.reserveBerth(pontoonId, m.id, m.boat.lengthM);
    if (given === undefined) m.waitlist(pontoonId);
    else m.activateContract(pontoonId, given.berth, Math.round(given.lengthM * SEASON_FEE_PER_METRE));
    this.members.put(m);
  }
}
