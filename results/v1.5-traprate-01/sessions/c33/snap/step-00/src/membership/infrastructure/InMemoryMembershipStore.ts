import type { EventLog } from '../../bus/EventLog';
import { Membership, type MembershipRecord } from '../domain/membership/Membership';
import type { MembershipRepository } from '../domain/membership/MembershipRepository';

export class InMemoryMembershipStore implements MembershipRepository {
  private readonly records = new Map<string, MembershipRecord>();
  private issued = 0;

  constructor(private readonly log: EventLog) {}

  nextId(): string {
    this.issued += 1;
    return `M-${String(this.issued).padStart(2, '0')}`;
  }

  get(id: string): Membership | undefined {
    const r = this.records.get(id);
    return r === undefined ? undefined : Membership.fromRecord(r);
  }

  put(membership: Membership): void {
    const events = membership.drainRecorded();
    this.records.set(membership.id, membership.toRecord());
    this.log.append(events);
  }
}
