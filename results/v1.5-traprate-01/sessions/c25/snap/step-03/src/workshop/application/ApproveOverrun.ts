import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import { WorkshopError } from '../domain/WorkshopError';

export class ApproveOverrun {
  constructor(private readonly jobs: JobRepository) {}

  execute(jobId: string): void {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    job.approveOverrun();
    this.jobs.save(job);
  }
}
