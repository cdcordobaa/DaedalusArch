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
