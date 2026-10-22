import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { WorkloadService } from '../business/services/WorkloadService';
import type { JobGateway } from '../persistence/JobGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly workloads: WorkloadService,
  ) {}

  /** Every mechanic with their open job count and oldest open plate, busiest first. */
  workload(): HttpResponse {
    return handle(() => this.workloads.workload());
  }

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => {
      const closed = this.jobs.closedOn(day);
      const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
      return { day, jobs: closed.length, takings: formatCents(cents) };
    });
  }
}
