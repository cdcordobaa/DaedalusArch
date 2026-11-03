import { JobRepositoryPort } from '../../../application/ports/out/job-repository.port';
import { RepairJob } from '../../../domain/repair-job';

export class InMemoryJobRepository implements JobRepositoryPort {
  private readonly rows = new Map<string, RepairJob>();

  async findById(id: string): Promise<RepairJob | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySupplyRef(supplyRef: string): Promise<RepairJob | null> {
    return [...this.rows.values()].find((j) => j.supplyReference === supplyRef) ?? null;
  }

  async save(job: RepairJob): Promise<void> {
    this.rows.set(job.id, job);
  }
}
