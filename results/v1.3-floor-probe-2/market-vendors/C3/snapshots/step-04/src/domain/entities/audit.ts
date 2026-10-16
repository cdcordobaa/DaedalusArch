export interface AuditEntry {
  id: string;
  kind: 'booking' | 'fee' | 'commission' | 'sale' | 'settlement';
  subjectId: string;
  marketDayId?: string;
  actor: string;
  at: string;
  before: unknown;
  after: unknown;
}

export const SYSTEM = 'system';
