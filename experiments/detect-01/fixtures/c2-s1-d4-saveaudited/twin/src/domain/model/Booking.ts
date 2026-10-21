import { AuditEntry } from './AuditRecord';
import { DateRange } from './DateRange';

/** Aggregate root: one booking of one room, with its audit trail. */
export class Booking {
  private status: 'active' | 'cancelled' = 'active';
  private readonly trail: AuditEntry[] = [];

  constructor(readonly id: string, readonly roomId: string, readonly stay: DateRange) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  cancel(by: string, at: Date): void {
    if (this.status === 'cancelled') throw new Error('Booking already cancelled');
    this.status = 'cancelled';
    this.trail.push(new AuditEntry('cancelled', by, at));
  }

  auditTrail(): readonly AuditEntry[] {
    return this.trail;
  }
}
