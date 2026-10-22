import type { WorkloadService } from '../business/services/WorkloadService';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD and GET /reports/workload. */
export class ReportsController {
  constructor(private readonly reports: WorkloadService) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => this.reports.dailyTakings(day));
  }

  /** Every mechanic with their open jobs, busiest first. */
  workload(): HttpResponse {
    return handle(() => this.reports.workload());
  }
}
