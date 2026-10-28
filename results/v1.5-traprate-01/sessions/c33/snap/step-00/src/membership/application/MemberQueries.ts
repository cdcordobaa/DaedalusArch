import type { MembershipView } from '../contracts/MembershipView';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';

export class MemberQueries {
  constructor(private readonly members: MembershipRepository) {}

  member(memberId: string): MembershipView | undefined {
    const m = this.members.get(memberId);
    if (m === undefined) return undefined;
    const r = m.toRecord();
    return { id: r.id, owner: r.owner, boatName: r.boatName, boatLengthM: r.boatLengthM, status: r.status, contract: r.contract, pontoonId: r.pontoonId, berth: null, feesDue: r.feesDue };
  }
}
