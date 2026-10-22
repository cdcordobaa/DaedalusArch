import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface WorkloadEntry {
  readonly mechanic: string;
  readonly openJobs: number;
  readonly oldestOpenPlate: string | null;
}

export class WorkloadService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): { day: string; jobs: number; takings: string } {
    const closed = this.jobs.closedOn(day);
    const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
    return { day, jobs: closed.length, takings: formatCents(cents) };
  }

  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first, then by name. */
  takingsByMechanic(month: string): { mechanic: string; takings: string }[] {
    const centsById = new Map<string, number>();
    for (const j of this.jobs.all()) {
      if (j.closedOn === null || !j.closedOn.startsWith(`${month}-`)) continue;
      centsById.set(j.mechanicId, (centsById.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
    }
    return [...centsById.entries()]
      .map(([id, cents]) => ({ mechanic: this.mechanics.byId(id)?.name ?? id, cents }))
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((e) => ({ mechanic: e.mechanic, takings: formatCents(e.cents) }));
  }

  /** Every mechanic with their open job count, busiest first, then by name. */
  workload(): WorkloadEntry[] {
    const open = this.jobs.all().filter((j) => j.closedOn === null);
    return this.mechanics
      .all()
      .map((m) => {
        const mine = open.filter((j) => j.mechanicId === m.id);
        let oldest: (typeof mine)[number] | undefined;
        for (const j of mine) if (oldest === undefined || j.openedOn < oldest.openedOn) oldest = j;
        return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: oldest === undefined ? null : oldest.plate };
      })
      .sort((a, b) => b.openJobs - a.openJobs || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
  }
}
