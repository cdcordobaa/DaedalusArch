import { AuditEntity, AuditRecord } from '../domain/audit';
import { AuditQueries } from '../ports/in/audit';
import { AuditRepository } from '../ports/out/audit';
import { Clock, IdGenerator } from '../ports/out/clock';

export class Auditor implements AuditQueries {
  constructor(private readonly repo: AuditRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}

  record(actor: string, entity: AuditEntity, entityId: string, before: unknown, after: unknown, animalId?: string): void {
    const r: AuditRecord = { id: this.ids.next('aud'), entity, entityId, animalId, actor, at: this.clock.now(), before, after };
    this.repo.append(r);
  }

  trailOfAnimal(animalId: string): AuditRecord[] { return this.repo.forAnimal(animalId); }
  changesBy(actor: string, from: string, to: string): AuditRecord[] { return this.repo.byActor(actor, from, to); }
}
