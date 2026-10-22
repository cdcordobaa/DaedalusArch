import { formatCents, jobTotalCents } from '../rules/Pricing';
import { WorkshopError } from '../errors/WorkshopError';
import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';

export interface TakingsEntry {
  readonly mechanic: string;
  readonly takings: string;
}

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

  /** Takings of the jobs each mechanic closed in the month (YYYY-MM), highest first; mechanics with none are left out. */
  takingsByMechanic(month: string): TakingsEntry[] {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new WorkshopError(`not a month: ${month}`);
    const closed = this.jobs.all().filter((j) => j.closedOn !== null && j.closedOn.slice(0, 7) === month);
    return this.mechanics
      .all()
      .map((m) => {
        const mine = closed.filter((j) => j.mechanicId === m.id);
        const cents = mine.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
        return { mechanic: m.name, jobs: mine.length, cents };
      })
      .filter((e) => e.jobs > 0)
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((e) => ({ mechanic: e.mechanic, takings: formatCents(e.cents) }));
  }

  /** Every mechanic with their open job count and the plate of their longest-open job, busiest first. */
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
