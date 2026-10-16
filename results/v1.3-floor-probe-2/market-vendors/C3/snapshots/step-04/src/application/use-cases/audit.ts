import { AuditEntry } from '../../domain/entities/audit';
import { AuditRepository } from '../../domain/repositories';
import { Clock, IdGenerator } from '../ports';

export class AuditLog {
  constructor(private readonly repo: AuditRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}

  record(actor: string, kind: AuditEntry['kind'], subjectId: string, before: unknown, after: unknown, marketDayId?: string): void {
    this.repo.append({ id: this.ids.next('aud'), kind, subjectId, marketDayId, actor, at: this.clock.now().toISOString(), before, after });
  }

  forDay(marketDayId: string): AuditEntry[] { return this.repo.forDay(marketDayId); }
}
