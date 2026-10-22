import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';
import { WorkshopError } from '../errors/WorkshopError';
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

  /** Mechanics who closed a job in the month (YYYY-MM), highest takings first, ties in name order. */
  takingsByMechanic(month: string): MechanicTakingsRow[] {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new WorkshopError(`not a month: ${month}`);
    const centsById = new Map<string, number>();
    for (const j of this.jobs.all()) {
      if (j.closedOn === null || j.closedOn.slice(0, 7) !== month) continue;
      centsById.set(j.mechanicId, (centsById.get(j.mechanicId) ?? 0) + jobTotalCents(j.labourMinutes, j.partsCents));
    }
    const rows = this.mechanics
      .all()
      .filter((m) => centsById.has(m.id))
      .map((m) => ({ mechanic: m.name, cents: centsById.get(m.id) ?? 0 }));
    rows.sort((a, b) => b.cents - a.cents || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
    return rows.map((r) => ({ mechanic: r.mechanic, takings: formatCents(r.cents) }));
  }
}
