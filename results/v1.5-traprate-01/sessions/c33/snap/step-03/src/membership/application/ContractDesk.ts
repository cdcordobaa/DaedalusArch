import { MembershipError } from '../domain/MembershipError';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';
import type { PontoonLookup } from './ports/PontoonLookup';

/** Seasonal berth contracts. */
export class ContractDesk {
  constructor(
    private readonly members: MembershipRepository,
    private readonly pontoons: PontoonLookup,
  ) {}

  signContract(memberId: string, pontoonId: string): void {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    if (!this.pontoons.exists(pontoonId)) throw new MembershipError(`no pontoon ${pontoonId}`);
    m.assertCanContract();
    const given = this.pontoons.reserveBerth(pontoonId, `member ${m.id}`, m.boat.lengthM);
    if (given === undefined) m.waitlist(pontoonId);
    else m.activateContract(pontoonId, given.berth, given.lengthM);
    this.members.put(m);
  }

  /** A member leaves unless fees are due; a berth they hold is freed at once. */
  resign(memberId: string): 'resigned' | 'refused' {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    const { pontoonId, berth } = m.toRecord();
    const outcome = m.resign();
    if (outcome === 'refused') return outcome;
    if (pontoonId !== null && berth !== null) this.pontoons.releaseBerth(pontoonId, `member ${m.id}`);
    this.members.put(m);
    return outcome;
  }

  /** A storm has closed the pontoon: active contracts on it end. */
  pontoonClosed(pontoonId: string): void {
    for (const m of this.members.onPontoon(pontoonId)) {
      m.stormClose(pontoonId);
      this.members.put(m);
    }
  }
}
