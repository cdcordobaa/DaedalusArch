import { TrackpointClient } from '../../adapters/out/gps/TrackpointClient';
import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import type { SuggestRider, Suggestion } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { jobHeldBy, requireJob } from './lookups';

export class SuggestRiderCase implements SuggestRider {
  private readonly trackpoint = new TrackpointClient();

  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<Suggestion | null> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'waiting') throw new DispatchRefusal(`job ${job.id} is not waiting`);
    const now = this.clock.now().getTime();
    let best: Suggestion | null = null;
    for (const rider of this.roster.list()) {
      if (!rider.isOnShift || jobHeldBy(this.ledger, rider.id) !== undefined) continue;
      const fix = await this.trackpoint.lastFix(rider.trackerId);
      if (fix === null || now - fix.fixedAtMs > 10 * 60_000) continue;
      const distanceMeters = Math.round(metersBetween({ lat: fix.latE7 / 1e7, lng: fix.lonE7 / 1e7 }, job.pickup));
      if (best === null || distanceMeters < best.distanceMeters) best = { riderId: rider.id, distanceMeters };
    }
    return best;
  }
}
