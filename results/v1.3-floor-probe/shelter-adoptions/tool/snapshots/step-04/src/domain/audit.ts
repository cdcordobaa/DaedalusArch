export type AuditedEntity = 'animal' | 'application' | 'placement' | 'notification';

export interface AuditEntry {
  id: string;
  entityType: AuditedEntity;
  entityId: string;
  animalId?: string;
  actor: string;
  at: string;
  before: unknown;
  after: unknown;
}

export const SYSTEM_ACTOR = 'system';
