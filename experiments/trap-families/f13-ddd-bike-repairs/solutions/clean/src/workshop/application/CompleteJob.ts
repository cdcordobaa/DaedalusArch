import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import type { PartLine } from '../domain/PartLine';
import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { WorkshopError } from '../domain/WorkshopError';

/** Completes the job; `SupplyCompletedJob` takes the parts off the shelves when the event is delivered. */
export class CompleteJob {
  constructor(
    private readonly jobs: JobRepository,
    private readonly stockrooms: StockroomRepository,
  ) {}

  execute(jobId: string, parts: readonly PartLine[]): void {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    job.complete(parts);
    stockroom.assertCanSupply(parts);
    this.jobs.save(job);
  }
}
