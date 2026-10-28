import { DispatchRefusal } from '../../domain/DispatchRefusal';
import { metersBetween } from '../../domain/geo';
import type { EstimateArrival } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderPositions } from '../ports/out/RiderPositions';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { requireJob, requireRider } from './lookups';

const MAX_POSITION_AGE_MS = 10 * 60 * 1000;
const METERS_PER_MINUTE = 250;
const HANDOVER_MINUTES = 2;

/** Whole minutes until a picked-up job reaches its drop-off point, handover included. */
export class EstimateArrivalCase implements EstimateArrival {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly positions: RiderPositions,
    private readonly clock: Clock,
  ) {}

  async run(jobId: string): Promise<number> {
    const job = requireJob(this.ledger, jobId);
    if (job.currentStatus !== 'picked-up' || job.riderId === null) {
      throw new DispatchRefusal(`job ${job.id} is not on its way`);
    }
    const rider = requireRider(this.roster, job.riderId);
    const position = await this.positions.latest(rider.trackerId);
    if (position === null || this.clock.now().getTime() - position.at.getTime() > MAX_POSITION_AGE_MS) {
      throw new DispatchRefusal(`no recent position for rider ${rider.id}`);
    }
    const meters = metersBetween(position.point, job.dropoff);
    return Math.ceil(meters / METERS_PER_MINUTE) + HANDOVER_MINUTES;
  }
}
