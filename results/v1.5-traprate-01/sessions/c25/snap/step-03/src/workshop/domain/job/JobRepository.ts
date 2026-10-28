import type { RepairJob } from './RepairJob';
import type { JobId } from './value-objects/JobId';

export interface JobRepository {
  nextId(): JobId;
  byId(id: JobId): RepairJob | undefined;
  /** Stores the job and its pending events in one step. */
  save(job: RepairJob): void;
}
