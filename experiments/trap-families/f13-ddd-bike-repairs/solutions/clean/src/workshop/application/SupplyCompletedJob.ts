import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { JobCompleted } from '../domain/job/events/JobCompleted';
import { MAIN_STOCKROOM } from '../domain/stock/Stockroom';
import type { StockroomRepository } from '../domain/stock/StockroomRepository';
import { WorkshopError } from '../domain/WorkshopError';

export class SupplyCompletedJob {
  constructor(private readonly stockrooms: StockroomRepository) {}

  handle(event: DomainEvent): void {
    const completed = event as JobCompleted;
    const stockroom = this.stockrooms.byId(MAIN_STOCKROOM);
    if (stockroom === undefined) throw new WorkshopError(`no stockroom ${MAIN_STOCKROOM}`);
    stockroom.supplyJob(completed.jobId, completed.parts);
    this.stockrooms.save(stockroom);
  }
}
