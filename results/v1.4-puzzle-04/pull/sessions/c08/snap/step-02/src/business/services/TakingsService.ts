import type { JobGateway } from '../../persistence/JobGateway';
import { formatCents, jobTotalCents } from '../rules/Pricing';

export interface DailyTakings {
  readonly day: string;
  readonly jobs: number;
  readonly takings: string;
}

export class TakingsService {
  constructor(private readonly jobs: JobGateway) {}

  /** Jobs closed on the day and what they brought in. */
  dailyTakings(day: string): DailyTakings {
    const closed = this.jobs.closedOn(day);
    const cents = closed.reduce((sum, j) => sum + jobTotalCents(j.labourMinutes, j.partsCents), 0);
    return { day, jobs: closed.length, takings: formatCents(cents) };
  }
}
