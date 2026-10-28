import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import type { RiderSuggestion, SuggestRider } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderPositions } from '../ports/out/RiderPositions';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { jobHeldBy, requireJob } from './lookups';

const MAX_POSITION_AGE_MS = 10 * 60 * 1000;

/** Suggests the free, on-shift rider with a fresh position closest to a waiting job's pickup. */
export class SuggestRiderCase implements SuggestRider {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly positions: RiderPositions,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<RiderSuggestion | null> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'waiting') throw new DispatchRefusal(`job ${job.id} is not waiting`);
    const nowMs = this.clock.now().getTime();
    let best: RiderSuggestion | null = null;
    let bestMeters = Infinity;
    for (const rider of this.roster.list()) {
      if (!rider.isOnShift || jobHeldBy(this.ledger, rider.id) !== undefined) continue;
      const position = await this.positions.latest(rider.trackerId);
      if (position === null || nowMs - position.at.getTime() > MAX_POSITION_AGE_MS) continue;
      const meters = metersBetween(job.pickup, position.point);
      if (meters < bestMeters) {
        bestMeters = meters;
        best = { riderId: rider.id, distanceMeters: Math.round(meters) };
      }
    }
    return best;
  }
}
