import { TrackpointClient } from '../../adapters/out/gps/TrackpointClient';
import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import type { EstimateArrival } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { requireJob, requireRider } from './lookups';

export class EstimateArrivalCase implements EstimateArrival {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<number> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'picked-up' || job.riderId === null) throw new DispatchRefusal(`job ${job.id} is not on its way`);
    const rider = requireRider(this.roster, job.riderId);
    const fix = await new TrackpointClient().lastFix(rider.trackerId);
    if (fix === null || this.clock.now().getTime() - fix.fixedAtMs > 10 * 60_000) throw new DispatchRefusal(`no recent position for rider ${rider.id}`);
    const meters = metersBetween({ lat: fix.latE7 / 1e7, lng: fix.lonE7 / 1e7 }, job.dropoff);
    return Math.ceil(meters / 250) + 2;
  }
}
