import { MembershipError } from '../domain/MembershipError';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';

export class Leaving {
  constructor(private readonly members: MembershipRepository) {}

  resign(memberId: string): 'resigned' | 'refused' {
    const m = this.members.get(memberId);
    if (m === undefined) throw new MembershipError(`no member ${memberId}`);
    const outcome = m.resign();
    this.members.put(m);
    return outcome;
  }
}
