import type { JobRepository } from '../domain/job/JobRepository';
import { RepairJob } from '../domain/job/RepairJob';

export class BookJob {
  constructor(private readonly jobs: JobRepository) {}

  execute(customer: string, bike: string): string {
    const job = RepairJob.book(this.jobs.nextId(), customer, bike);
    this.jobs.save(job);
    return job.id.value;
  }
}
