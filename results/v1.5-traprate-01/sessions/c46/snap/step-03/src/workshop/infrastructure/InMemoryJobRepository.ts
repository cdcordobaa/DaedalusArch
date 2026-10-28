import type { JobRepository } from '../domain/job/JobRepository';
import { RepairJob, type RepairJobState } from '../domain/job/RepairJob';
import { JobId } from '../domain/job/value-objects/JobId';
import type { InMemoryOutbox } from './InMemoryOutbox';

/** Saving a job stores its pending events in the shared outbox in the same step. */
export class InMemoryJobRepository implements JobRepository {
  private readonly rows = new Map<string, RepairJobState>();
  private sequence = 0;

  constructor(private readonly outbox: InMemoryOutbox) {}

  nextId(): JobId {
    this.sequence += 1;
    return JobId.of(`J-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: JobId): RepairJob | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : RepairJob.restore(row);
  }

  save(job: RepairJob): void {
    const events = job.pullEvents();
    this.rows.set(job.id.value, job.state());
    this.outbox.append(events);
  }
}
