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

  /** Every mechanic with their open job count and the plate of their longest-open job, busiest first. */
  workload(): HttpResponse {
    return handle(() => {
      const open = this.jobs.open();
      return this.mechanics
        .all()
        .map((m) => {
          const mine = open.filter((j) => j.mechanicId === m.id);
          let oldest: (typeof mine)[number] | undefined;
          for (const j of mine) if (oldest === undefined || j.openedOn < oldest.openedOn) oldest = j;
          return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: oldest === undefined ? null : oldest.plate };
        })
        .sort((a, b) => b.openJobs - a.openJobs || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
    });
  }

  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first. */
  takingsByMechanic(month: string): HttpResponse {
    return handle(() => {
      const names = new Map(this.mechanics.all().map((m) => [m.id, m.name]));
      const centsById = new Map<string, number>();
      for (const j of this.jobs.closedInMonth(month)) {
        centsById.set(j.mechanicId, (centsById.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
      }
      return [...centsById.entries()]
        .map(([id, cents]) => ({ mechanic: names.get(id) ?? id, cents }))
        .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
        .map((r) => ({ mechanic: r.mechanic, takings: formatCents(r.cents) }));
    });
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
