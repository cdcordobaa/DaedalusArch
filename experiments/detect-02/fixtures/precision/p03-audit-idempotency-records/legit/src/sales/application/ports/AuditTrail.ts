import type { AuditEntry } from '../../domain/audit/AuditEntry';

export interface AuditTrail {
  record(entry: AuditEntry): Promise<void>;
  forSubject(subjectId: string): Promise<readonly AuditEntry[]>;
}
