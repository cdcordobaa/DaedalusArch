import type { TakingsService } from '../business/services/TakingsService';
import type { WorkloadService } from '../business/services/WorkloadService';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD and GET /reports/workload. */
export class ReportsController {
  constructor(
    private readonly takings: TakingsService,
    private readonly workloadBoard: WorkloadService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => this.takings.dailyTakings(day));
  }

  /** Every mechanic's open jobs, busiest first. */
  workload(): HttpResponse {
    return handle(() => this.workloadBoard.workload());
  }
}
