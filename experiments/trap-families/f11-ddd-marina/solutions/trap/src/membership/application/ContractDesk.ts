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
    m.requestContract(pontoonId);
    const given = this.pontoons.take(pontoonId, m.id, m.boat.lengthM);
    if (given === null) m.waitlist();
    else m.activate(given.berth, given.lengthM);
    this.members.put(m);
  }

  stormClose(memberId: string, pontoonId: string): void {
    const m = this.members.get(memberId);
    if (m === undefined) return;
    m.stormClose(pontoonId);
    this.members.put(m);
  }

  resign(memberId: string): string {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    if (m.hasResigned) return 'resigned';
    if (!m.canLeave) return 'refused';
    const pontoonId = m.heldBerthOn;
    if (pontoonId !== null) this.pontoons.release(pontoonId, m.id);
    m.resign();
    this.members.put(m);
    return 'resigned';
  }
}
