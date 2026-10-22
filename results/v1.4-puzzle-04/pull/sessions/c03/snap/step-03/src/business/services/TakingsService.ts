import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface MechanicTakings {
  readonly mechanic: string;
  readonly takings: string;
}

export class TakingsService {
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
  takingsByMechanic(month: string): MechanicTakings[] {
    const cents = new Map<string, number>();
    for (const j of this.jobs.all()) {
      if (j.closedOn === null || !j.closedOn.startsWith(`${month}-`)) continue;
      cents.set(j.mechanicId, (cents.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
    }
    return this.mechanics
      .all()
      .filter((m) => cents.has(m.id))
      .map((m) => ({ mechanic: m.name, cents: cents.get(m.id) ?? 0 }))
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((e) => ({ mechanic: e.mechanic, takings: formatCents(e.cents) }));
  }
}
