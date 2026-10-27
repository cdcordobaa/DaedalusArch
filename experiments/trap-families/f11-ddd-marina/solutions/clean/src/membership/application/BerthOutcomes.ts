import type { MembershipRepository } from '../domain/membership/MembershipRepository';

/** What the pontoons answered, applied to each membership on its own. */
export class BerthOutcomes {
  constructor(private readonly members: MembershipRepository) {}

  granted(memberId: string, pontoonId: string, berth: number, lengthM: number): void {
    const m = this.members.get(memberId);
    if (m === undefined) return;
    m.berthGranted(pontoonId, berth, lengthM);
    this.members.put(m);
  }

  refused(memberId: string, pontoonId: string): void {
    const m = this.members.get(memberId);
    if (m === undefined) return;
    m.berthRefused(pontoonId);
    this.members.put(m);
  }

  pontoonClosed(pontoonId: string, occupants: readonly string[]): void {
    for (const occupant of occupants) {
      const m = this.members.get(occupant);
      if (m === undefined) continue; // a visiting boat
      m.pontoonClosed(pontoonId);
      this.members.put(m);
    }
  }
}
