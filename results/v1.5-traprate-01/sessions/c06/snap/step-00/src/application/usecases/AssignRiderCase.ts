import type { JobView } from '../../domain/DeliveryJob';
import { DispatchRefusal } from '../../domain/DispatchRefusal';
import type { AssignRider } from '../ports/in/Dispatching';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { jobHeldBy, requireJob, requireRider } from './lookups';

/** Hands a waiting job to a rider who is on shift and free. */
export class AssignRiderCase implements AssignRider {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
  ) {}

  run(jobId: string, riderId: string): JobView {
    const job = requireJob(this.ledger, jobId);
    const rider = requireRider(this.roster, riderId);
    if (!rider.isOnShift) throw new DispatchRefusal(`rider ${rider.id} is off shift`);
    const held = jobHeldBy(this.ledger, rider.id);
    if (held !== undefined) throw new DispatchRefusal(`rider ${rider.id} already has job ${held.id}`);
    job.giveTo(rider.id);
    this.ledger.save(job);
    return job.view();
  }
}
