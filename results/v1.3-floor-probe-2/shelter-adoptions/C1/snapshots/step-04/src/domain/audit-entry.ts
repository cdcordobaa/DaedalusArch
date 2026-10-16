export interface AuditEntry {
  id: string;
  subject: 'animal' | 'application' | 'placement' | 'notification';
  subjectId: string;
  animalId?: string;
  changedBy: string;
  changedAt: string;
  before: unknown;
  after: unknown;
}

export const WEBHOOK_ACTOR = 'system';

export function snapshot(x: unknown): unknown { return x === undefined || x === null ? null : JSON.parse(JSON.stringify(x)); }
