import type { JobRecord } from './records/JobRecord';
import type { MechanicRecord } from './records/MechanicRecord';

/** The workshop's tables (in memory). */
export class Database {
  readonly jobs = new Map<string, JobRecord>();
  readonly mechanics = new Map<string, MechanicRecord>();
  private sequence = 0;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, '0')}`;
  }
}
