import { AuditRecord } from '../../domain/audit';

export interface AuditQueries {
  trailOfAnimal(animalId: string): AuditRecord[];
  changesBy(actor: string, from: string, to: string): AuditRecord[];
}
