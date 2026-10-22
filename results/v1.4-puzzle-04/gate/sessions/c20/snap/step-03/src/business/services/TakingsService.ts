import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface MechanicTakingsLine {
  readonly mechanic: string;
  readonly takings: string;
}

export class TakingsService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Takings per mechanic for jobs closed in the month (YYYY-MM), highest first, then by name. */
  byMechanic(month: string): MechanicTakingsLine[] {
    const closed = this.jobs.closedIn(month);
    return this.mechanics
      .all()
      .map((m) => {
        const mine = closed.filter((j) => j.mechanicId === m.id);
        const cents = mine.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
        return { mechanic: m.name, jobs: mine.length, cents };
      })
      .filter((l) => l.jobs > 0)
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((l) => ({ mechanic: l.mechanic, takings: formatCents(l.cents) }));
  }
}
