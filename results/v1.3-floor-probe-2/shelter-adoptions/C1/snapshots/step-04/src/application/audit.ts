import { AuditEntry, snapshot } from '../domain/audit-entry';
import { AuditTrail } from './ports/inbound';
import { AuditStore, Clock, IdFactory, TransactionRunner } from './ports/outbound';

export class AuditService implements AuditTrail {
  constructor(private readonly store: AuditStore, private readonly tx: TransactionRunner, private readonly clock: Clock, private readonly ids: IdFactory) {}

  /** Applies the change and writes its audit entry in one transaction. `before` is captured before the change runs. */
  record<T>(changedBy: string, subject: AuditEntry['subject'], subjectId: string, animalId: string | undefined, current: unknown, change: () => T, after: () => unknown): T {
    const before = snapshot(current);
    return this.tx.inTransaction(() => {
      const r = change();
      this.store.add({ id: this.ids.newId(), subject, subjectId, animalId, changedBy, changedAt: this.clock.nowIso(), before, after: snapshot(after()) });
      return r;
    });
  }

  transaction<T>(fn: () => T): T { return this.tx.inTransaction(fn); }

  ofAnimal(animalId: string): AuditEntry[] { return this.store.byAnimal(animalId); }
  byStaff(staffId: string, from: string, to: string): AuditEntry[] { return this.store.byStaff(staffId, from, to); }
}
