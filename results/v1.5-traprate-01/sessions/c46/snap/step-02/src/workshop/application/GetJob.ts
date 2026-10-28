import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import { WorkshopError } from '../domain/WorkshopError';

export interface JobView {
  readonly status: string;
  readonly labourHours: number;
}

export class GetJob {
  constructor(private readonly jobs: JobRepository) {}

  execute(jobId: string): JobView {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    return { status: job.status, labourHours: job.labourMinutes / 60 };
  }
}
