import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicGateway } from '../../persistence/MechanicGateway';

export interface WorkloadRow {
  readonly mechanic: string;
  readonly openJobs: number;
  readonly oldestOpenPlate: string | null;
}

export class WorkloadService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicGateway,
  ) {}

  /** Every mechanic with their open jobs, busiest first, then by name. */
  workload(): WorkloadRow[] {
    const open = this.jobs.all().filter((j) => j.closedOn === null);
    const rows = this.mechanics.all().map((m): WorkloadRow => {
      const mine = open.filter((j) => j.mechanicId === m.id);
      let oldest: { plate: string; openedOn: string } | undefined;
      for (const j of mine) if (oldest === undefined || j.openedOn < oldest.openedOn) oldest = j;
      return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: oldest === undefined ? null : oldest.plate };
    });
    return rows.sort((a, b) => b.openJobs - a.openJobs || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
  }
}
