import type { TakingsService } from '../business/services/TakingsService';
import type { WorkloadService } from '../business/services/WorkloadService';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
export class ReportsController {
  constructor(
    private readonly workloads: WorkloadService,
    private readonly takings: TakingsService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => this.takings.dailyTakings(day));
  }

  /** Takings per mechanic for jobs closed in the month (YYYY-MM). */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => this.takings.takingsByMechanic(month));
  }

  /** Every mechanic with their open job count and the plate of their longest-open job. */
  workload(): HttpResponse {
    return handle(() => {
      return this.workloads.workload();
    });
  }
}
