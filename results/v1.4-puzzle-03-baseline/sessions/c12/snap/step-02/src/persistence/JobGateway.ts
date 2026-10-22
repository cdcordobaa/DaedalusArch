import type { Database } from './Database';
import type { JobRecord } from './records/JobRecord';

export class JobGateway {
  constructor(private readonly db: Database) {}

  insert(record: Omit<JobRecord, 'id'>): JobRecord {
    const row = { ...record, id: this.db.nextId('J') };
    this.db.jobs.set(row.id, row);
    return { ...row };
  }

  update(record: JobRecord): void {
    this.db.jobs.set(record.id, { ...record });
  }

  byId(id: string): JobRecord | undefined {
    const row = this.db.jobs.get(id);
    return row === undefined ? undefined : { ...row };
  }

  all(): JobRecord[] {
    return [...this.db.jobs.values()].map((j) => ({ ...j }));
  }

  open(): JobRecord[] {
    return this.all().filter((j) => j.closedOn === null);
  }

  closedOn(day: string): JobRecord[] {
    return this.all().filter((j) => j.closedOn === day);
  }
}
