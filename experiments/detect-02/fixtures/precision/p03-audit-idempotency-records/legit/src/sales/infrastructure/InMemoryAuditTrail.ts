import type { AuditEntry } from '../domain/audit/AuditEntry';
import type { AuditTrail } from '../application/ports/AuditTrail';

export class InMemoryAuditTrail implements AuditTrail {
  private readonly rows: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.rows.push(entry);
  }

  async forSubject(subjectId: string): Promise<readonly AuditEntry[]> {
    return this.rows.filter((r) => r.subjectId === subjectId);
  }
}
