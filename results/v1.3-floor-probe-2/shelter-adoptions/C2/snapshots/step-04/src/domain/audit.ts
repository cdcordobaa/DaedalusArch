export type AuditEntity = 'animal' | 'application' | 'placement' | 'notification';

export interface AuditRecord {
  id: string;
  entity: AuditEntity;
  entityId: string;
  /** The animal the change belongs to, so an animal's trail includes its applications and placements. */
  animalId?: string;
  actor: string;
  at: string;
  before: unknown;
  after: unknown;
}

export const SYSTEM_ACTOR = 'system';
