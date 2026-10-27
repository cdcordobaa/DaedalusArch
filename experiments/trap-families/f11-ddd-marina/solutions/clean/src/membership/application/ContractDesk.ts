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
    this.members.put(m);
  }
}
