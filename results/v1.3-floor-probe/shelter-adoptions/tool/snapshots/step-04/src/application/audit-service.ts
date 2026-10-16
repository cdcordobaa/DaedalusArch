import { AuditEntry, AuditedEntity } from '../domain/audit';
import { AuditLogRepository, IdGenerator } from './ports';

export class AuditService {
  constructor(
    private readonly log: AuditLogRepository,
    private readonly ids: IdGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  record(actor: string, entityType: AuditedEntity, entityId: string, animalId: string | undefined, before: unknown, after: unknown): void {
    this.log.append({
      id: this.ids.next(),
      entityType,
      entityId,
      animalId,
      actor,
      at: this.now().toISOString(),
      before: before ?? null,
      after: after ?? null,
    });
  }

  trailForAnimal(animalId: string): AuditEntry[] {
    return this.log.findByAnimal(animalId);
  }

  changesBy(actor: string, from: string, to: string): AuditEntry[] {
    return this.log.findByActor(actor, from, to);
  }
}
