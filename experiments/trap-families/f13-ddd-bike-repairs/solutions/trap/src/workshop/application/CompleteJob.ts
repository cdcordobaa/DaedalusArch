import type { JobRepository } from '../domain/job/JobRepository';
import { JobId } from '../domain/job/value-objects/JobId';
import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { Sku } from '../domain/stock/value-objects/Sku';
import { WorkshopError } from '../domain/WorkshopError';

const LABOUR_CAP_MINUTES = 240;

export class CompleteJob {
  constructor(
    private readonly jobs: JobRepository,
    private readonly stockrooms: StockroomRepository,
  ) {}

  execute(jobId: string, parts: readonly { sku: string; quantity: number }[]): void {
    const job = this.jobs.byId(JobId.of(jobId));
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    job.complete();
    if (job.labourMinutes > LABOUR_CAP_MINUTES && !job.overrunApproved) {
      throw new WorkshopError(`labour cap exceeded: ${jobId} has ${(job.labourMinutes / 60).toFixed(2)} h logged, 4.00 h allowed without approval`);
    }
    for (const line of parts) stockroom.take(Sku.of(line.sku), line.quantity, jobId);
    this.jobs.save(job);
    this.stockrooms.save(stockroom);
  }
}
