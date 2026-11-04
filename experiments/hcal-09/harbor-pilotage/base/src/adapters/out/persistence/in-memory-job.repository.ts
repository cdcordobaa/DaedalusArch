import { PilotageJob } from '@harbor/domain/pilotage-job';
import { JobRepositoryPort } from '../../../application/ports/out/job-repository.port';

export class InMemoryJobRepository implements JobRepositoryPort {
  private readonly rows = new Map<string, PilotageJob>();

  constructor(seed: readonly PilotageJob[] = []) {
    for (const job of seed) this.rows.set(job.id, job);
  }

  async findById(id: string): Promise<PilotageJob | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlotRef(slotRef: string): Promise<PilotageJob | null> {
    return [...this.rows.values()].find((j) => j.slotReference === slotRef) ?? null;
  }

  async save(job: PilotageJob): Promise<void> {
    this.rows.set(job.id, job);
  }
}
