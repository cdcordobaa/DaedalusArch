import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface WorkloadLine {
  readonly mechanic: string;
  readonly openJobs: number;
  readonly oldestOpenPlate: string | null;
}

export interface TakingsLine {
  readonly mechanic: string;
  readonly takings: string;
}

export class ReportService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Open jobs per mechanic, busiest first, then by name. */
  workload(): WorkloadLine[] {
    const open = this.jobs.all().filter((j) => j.closedOn === null);
    return this.mechanics
      .all()
      .map((m) => {
        const mine = open.filter((j) => j.mechanicId === m.id).sort((a, b) => a.openedOn.localeCompare(b.openedOn));
        return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: mine[0]?.plate ?? null };
      })
      .sort((a, b) => b.openJobs - a.openJobs || a.mechanic.localeCompare(b.mechanic));
  }

  /** What each mechanic's jobs closed in the month (YYYY-MM) brought in, highest first; mechanics with none left out. */
  takingsByMechanic(month: string): TakingsLine[] {
    const closed = this.jobs.all().filter((j) => j.closedOn !== null && j.closedOn.startsWith(`${month}-`));
    return this.mechanics
      .all()
      .map((m) => ({ mechanic: m.name, jobs: closed.filter((j) => j.mechanicId === m.id) }))
      .filter((t) => t.jobs.length > 0)
      .map((t) => ({ mechanic: t.mechanic, cents: t.jobs.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0) }))
      .sort((a, b) => b.cents - a.cents || a.mechanic.localeCompare(b.mechanic))
      .map((t) => ({ mechanic: t.mechanic, takings: formatCents(t.cents) }));
  }
}
