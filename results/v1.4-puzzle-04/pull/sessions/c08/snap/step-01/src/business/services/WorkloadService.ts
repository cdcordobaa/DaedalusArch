import type { JobGateway } from '../../persistence/JobGateway';
import type { MechanicService } from './MechanicService';

export interface WorkloadRow {
  readonly mechanic: string;
  readonly openJobs: number;
  readonly oldestOpenPlate: string | null;
}

export class WorkloadService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicService,
  ) {}

  /** Every mechanic with their open jobs, busiest first, then by name. */
  workload(): WorkloadRow[] {
    const open = this.jobs.all().filter((j) => j.closedOn === null);
    const rows = this.mechanics.all().map((m) => {
      const mine = open.filter((j) => j.mechanicId === m.id);
      let oldest: (typeof mine)[number] | undefined;
      for (const j of mine) if (oldest === undefined || j.openedOn < oldest.openedOn) oldest = j;
      return { mechanic: m.name, openJobs: mine.length, oldestOpenPlate: oldest === undefined ? null : oldest.plate };
    });
    return rows.sort((a, b) => b.openJobs - a.openJobs || (a.mechanic < b.mechanic ? -1 : a.mechanic > b.mechanic ? 1 : 0));
  }
}
