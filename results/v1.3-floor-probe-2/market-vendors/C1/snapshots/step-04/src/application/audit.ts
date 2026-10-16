import { AuditEntry } from '../domain/model';
import { AuditLog, Transactor } from '../domain/repositories';
import { Clock, IdSource } from './market-service';

export const SYSTEM = 'system';

export class Auditing {
  constructor(private readonly log: AuditLog, private readonly tx: Transactor, private readonly ids: IdSource, private readonly clock: Clock) {}

  /** Runs the change and records it in one transaction. */
  change<T>(actor: string, type: AuditEntry['type'], ref: string, dayId: string | undefined, before: unknown, work: () => T): T {
    return this.tx.run(() => {
      const after = work();
      this.log.append({ id: this.ids.next(), type, ref, dayId, actor, at: this.clock.now().toISOString(), before: before ?? null, after });
      return after;
    });
  }

  ofDay(dayId: string): AuditEntry[] { return this.log.ofDay(dayId); }
}
