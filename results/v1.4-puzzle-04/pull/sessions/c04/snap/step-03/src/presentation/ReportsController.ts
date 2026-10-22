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
    return handle(() => this.takings.daily(day));
  }

  /** Takings per mechanic for the jobs closed in the month (YYYY-MM). */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => this.takings.byMechanic(month));
  }

  /** Every mechanic with their open jobs, busiest first. */
  workload(): HttpResponse {
    return handle(() => this.workloads.workload());
  }
}
