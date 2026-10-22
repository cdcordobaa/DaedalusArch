import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD, GET /reports/workload, GET /reports/takings-by-mechanic?month=YYYY-MM. */
export class ReportsController {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): HttpResponse {
    return handle(() => {
      const closed = this.jobs.closedOn(day);
      const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
      return { day, jobs: closed.length, takings: formatCents(cents) };
    });
  }

  /** Open jobs per mechanic, busiest first, then by name. */
  workload(): HttpResponse {
    return handle(() => {
      const open = this.jobs.all().filter((j) => j.closedOn === null);
      return this.mechanics
        .all()
        .map((m) => {
          const mine = open.filter((j) => j.mechanicId === m.id).sort((a, b) => a.openedOn.localeCompare(b.openedOn));
          return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: mine[0]?.plate ?? null };
        })
        .sort((a, b) => b.openJobs - a.openJobs || a.mechanic.localeCompare(b.mechanic));
    });
  }

  /** What each mechanic's jobs closed in the month brought in, highest first. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const closed = this.jobs.all().filter((j) => j.closedOn !== null && j.closedOn.startsWith(`${month}-`));
      return this.mechanics
        .all()
        .map((m) => ({ mechanic: m.name, jobs: closed.filter((j) => j.mechanicId === m.id) }))
        .filter((t) => t.jobs.length > 0)
        .map((t) => ({ mechanic: t.mechanic, cents: t.jobs.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0) }))
        .sort((a, b) => b.cents - a.cents || a.mechanic.localeCompare(b.mechanic))
        .map((t) => ({ mechanic: t.mechanic, takings: formatCents(t.cents) }));
    });
  }
}
