import { AuditRecord, Audited } from '../../domain/entities/audit-record';
import { AuditRepo, Clock, Ids } from '../interfaces/repositories';

export const SYSTEM_ACTOR = 'system';

/** Writes the audit trail; called by the other use cases inside their unit of work. */
export class AuditTrail {
  constructor(private repo: AuditRepo, private ids: Ids, private clock: Clock) {}

  log(by: string, what: Audited, refId: string, marketDayId: string | null, before: unknown, after: unknown): void {
    this.repo.add(new AuditRecord(this.ids.create(), what, refId, marketDayId, by, this.clock.now().toISOString(), clone(before), clone(after)));
  }

  forMarketDay(marketDayId: string): AuditRecord[] { return this.repo.forMarketDay(marketDayId); }
}

function clone(x: unknown): unknown { return x === undefined || x === null ? null : JSON.parse(JSON.stringify(x)); }
