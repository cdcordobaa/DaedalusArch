import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { ReportService } from '../business/services/ReportService';
import type { JobGateway } from '../persistence/JobGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD, GET /reports/workload, GET /reports/takings-by-mechanic?month=YYYY-MM. */
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly reports: ReportService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => {
      const closed = this.jobs.closedOn(day);
      const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
      return { day, jobs: closed.length, takings: formatCents(cents) };
    });
  }

  workload(): HttpResponse {
    return handle(() => this.reports.workload());
  }

  takingsByMechanic(month: string): HttpResponse {
    return handle(() => this.reports.takingsByMechanic(month));
  }
}
