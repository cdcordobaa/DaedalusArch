import type { JobLedger } from '../../../application/ports/out/JobLedger';
import type { DeliveryJob } from '../../../domain/DeliveryJob';

export class MemoryJobLedger implements JobLedger {
  private readonly jobs = new Map<string, DeliveryJob>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return `J-${String(this.counter)}`;
  }

  save(job: DeliveryJob): void {
    this.jobs.set(job.id, job);
  }

  find(id: string): DeliveryJob | undefined {
    return this.jobs.get(id);
  }

  list(): DeliveryJob[] {
    return [...this.jobs.values()];
  }
}
