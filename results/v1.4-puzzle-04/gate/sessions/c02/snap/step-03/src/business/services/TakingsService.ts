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

  /** Takings per mechanic with at least one job closed in the month (YYYY-MM), highest first then by name. */
  byMechanic(month: string): MechanicTakings[] {
    const centsById = new Map<string, number>();
    for (const j of this.jobs.closedInMonth(month)) {
      centsById.set(j.mechanicId, (centsById.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
    }
    return [...centsById.entries()]
      .map(([id, cents]) => ({ mechanic: this.mechanics.byId(id)?.name ?? id, cents }))
      .sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0))
      .map((e) => ({ mechanic: e.mechanic, takings: formatCents(e.cents) }));
  }
}
