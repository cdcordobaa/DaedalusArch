import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import { isRecent } from '../../domain/whereabouts';
import type { SuggestRider, Suggestion } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderPositions } from '../ports/out/RiderPositions';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { jobHeldBy, requireJob } from './lookups';

/** The free, on-shift rider with a recent position closest to a waiting job's pickup point. */
export class SuggestRiderCase implements SuggestRider {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly positions: RiderPositions,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<Suggestion | null> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'waiting') throw new DispatchRefusal(`job ${job.id} is not waiting`);
    const now = this.clock.now();
    let best: Suggestion | null = null;
    for (const rider of this.roster.list()) {
      if (!rider.isOnShift || jobHeldBy(this.ledger, rider.id) !== undefined) continue;
      const fix = await this.positions.latestFix(rider.trackerId);
      if (fix === null || !isRecent(fix, now)) continue;
      const distanceMeters = Math.round(metersBetween(fix.at, job.pickup));
      if (best === null || distanceMeters < best.distanceMeters) best = { riderId: rider.id, distanceMeters };
    }
    return best;
  }
}
