import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface MechanicTakingsRow {
  readonly mechanic: string;
  readonly takings: string;
}

export class TakingsService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Jobs closed on the day (YYYY-MM-DD) and what they brought in. */
  dailyTakings(day: string): { day: string; jobs: number; takings: string } {
    const closed = this.jobs.closedOn(day);
    const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
    return { day, jobs: closed.length, takings: formatCents(cents) };
  }

  /** Mechanics who closed a job in the month (YYYY-MM), highest takings first, then by name. */
  takingsByMechanic(month: string): MechanicTakingsRow[] {
    const names = new Map(this.mechanics.all().map((m) => [m.id, m.name]));
    const centsById = new Map<string, number>();
    for (const j of this.jobs.all()) {
      if (j.closedOn === null || j.closedOn.slice(0, 7) !== month) continue;
      centsById.set(j.mechanicId, (centsById.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
    }
    return [...centsById.entries()]
      .map(([id, cents]) => ({ mechanic: names.get(id) ?? id, cents }))
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((r): MechanicTakingsRow => ({ mechanic: r.mechanic, takings: formatCents(r.cents) }));
  }
}
