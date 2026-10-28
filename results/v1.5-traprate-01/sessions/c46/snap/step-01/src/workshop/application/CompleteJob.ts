import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { Sku } from '../domain/stock/value-objects/Sku';
import { WorkshopError } from '../domain/WorkshopError';

export interface FittedPart {
  readonly sku: string;
  readonly quantity: number;
}

export class CompleteJob {
  constructor(
    private readonly jobs: JobRepository,
    private readonly stockrooms: StockroomRepository,
  ) {}

  execute(jobId: string, parts: ReadonlyArray<FittedPart>): void {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    // Both changes are made and checked in memory first; nothing is stored unless both succeed.
    job.complete();
    stockroom.remove(parts.map((p) => ({ sku: Sku.of(p.sku), quantity: p.quantity })));
    this.jobs.save(job);
    this.stockrooms.save(stockroom);
  }
}
