import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import { isRecent, minutesToArrive } from '../../domain/whereabouts';
import type { EstimateArrival } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderPositions } from '../ports/out/RiderPositions';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { requireJob, requireRider } from './lookups';

export class EstimateArrivalCase implements EstimateArrival {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly positions: RiderPositions,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<number> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'picked-up' || job.riderId === null) throw new DispatchRefusal(`job ${job.id} is not on its way`);
    const rider = requireRider(this.roster, job.riderId);
    const fix = await this.positions.latestFix(rider.trackerId);
    if (fix === null || !isRecent(fix, this.clock.now())) throw new DispatchRefusal(`no recent position for rider ${rider.id}`);
    return minutesToArrive(metersBetween(fix.at, job.dropoff));
  }
}
