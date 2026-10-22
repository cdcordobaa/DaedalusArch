import type { JobGateway } from '../../persistence/JobGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';
import type { MechanicService } from './MechanicService';

export interface DailyTakings {
  readonly day: string;
  readonly jobs: number;
  readonly takings: string;
}

export interface MechanicTakings {
  readonly mechanic: string;
  readonly takings: string;
}

export class TakingsService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicService,
  ) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): DailyTakings {
    const closed = this.jobs.closedOn(day);
    const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
    return { day, jobs: closed.length, takings: formatCents(cents) };
  }

  /** What each mechanic's jobs closed in the month (YYYY-MM) brought in, highest first, then by name. */
  takingsByMechanic(month: string): MechanicTakings[] {
    const closed = this.jobs.all().filter((j) => j.closedOn !== null && j.closedOn.startsWith(`${month}-`));
    const rows = this.mechanics.all().flatMap((m) => {
      const mine = closed.filter((j) => j.mechanicId === m.id);
      if (mine.length === 0) return [];
      const cents = mine.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
      return [{ mechanic: m.name, cents }];
    });
    rows.sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
    return rows.map((r) => ({ mechanic: r.mechanic, takings: formatCents(r.cents) }));
  }
}
