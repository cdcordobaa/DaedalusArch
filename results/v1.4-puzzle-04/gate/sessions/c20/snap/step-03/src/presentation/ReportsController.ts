import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { TakingsService } from '../business/services/TakingsService';
import type { WorkloadService } from '../business/services/WorkloadService';
import type { JobGateway } from '../persistence/JobGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly workloadBoard: WorkloadService,
    private readonly takingsBoard: TakingsService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => {
      const closed = this.jobs.closedOn(day);
      const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
      return { day, jobs: closed.length, takings: formatCents(cents) };
    });
  }

  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => this.takingsBoard.byMechanic(month));
  }

  /** Every mechanic with their open jobs, busiest first, then by name. */
  workload(): HttpResponse {
    return handle(() => this.workloadBoard.workload());
  }
}
