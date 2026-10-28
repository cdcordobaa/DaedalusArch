import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import { WorkshopError } from '../domain/WorkshopError';

export class LogLabour {
  constructor(private readonly jobs: JobRepository) {}

  execute(jobId: string, hours: number): void {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    job.logLabour(hours);
    this.jobs.save(job);
  }
}
