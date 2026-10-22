import type { TakingsService } from '../business/services/TakingsService';
import type { WorkloadService } from '../business/services/WorkloadService';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD, GET /reports/workload and takings per mechanic for a month. */
export class ReportsController {
  constructor(
    private readonly workloads: WorkloadService,
    private readonly takings: TakingsService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => this.takings.dailyTakings(day));
  }

  /** Takings per mechanic for a month (YYYY-MM), highest first. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => this.takings.takingsByMechanic(month));
  }

  /** Every mechanic with their open jobs, busiest first. */
  workload(): HttpResponse {
    return handle(() => this.workloads.workload());
  }
}
