import { formatCents, jobTotalCents } from '../business/rules/Pricing';
import type { JobGateway } from '../persistence/JobGateway';
import type { MechanicGateway } from '../persistence/MechanicGateway';
import { handle, type HttpResponse } from './HttpResponse';

/** GET /reports/takings?day=YYYY-MM-DD. */
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

  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first then by name. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const cents = new Map<string, number>();
      for (const j of this.jobs.closedIn(month)) {
        cents.set(j.mechanicId, (cents.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
      }
      return [...cents.entries()]
        .map(([id, total]) => ({ mechanic: this.mechanics.byId(id)?.name ?? id, total }))
        .sort((a, b) => b.total - a.total || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
        .map((r) => ({ mechanic: r.mechanic, takings: formatCents(r.total) }));
    });
  }

  /** Every mechanic with their open jobs, busiest first then by name. */
  workload(): HttpResponse {
    return handle(() => {
      const open = this.jobs.open();
      return this.mechanics
        .all()
        .map((m) => {
          const mine = open
            .filter((j) => j.mechanicId === m.id)
            .sort((a, b) => (a.openedOn < b.openedOn ? -1 : a.openedOn > b.openedOn ? 1 : 0));
          return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: mine[0]?.plate ?? null };
        })
        .sort((a, b) => b.openJobs - a.openJobs || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
    });
  }
}
