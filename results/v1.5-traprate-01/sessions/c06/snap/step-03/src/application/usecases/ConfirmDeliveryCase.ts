import type { JobView } from '../../domain/DeliveryJob';
import type { ConfirmDelivery } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import type { RiderRoster } from '../ports/out/RiderRoster';
import { requireJob, requireRider } from './lookups';

/** Closes a picked-up job at the door, freeing the rider. */
export class ConfirmDeliveryCase implements ConfirmDelivery {
  constructor(
    private readonly ledger: JobLedger,
    private readonly roster: RiderRoster,
    private readonly clock: Clock,
  ) {}

  run(jobId: string, riderId: string, proof: { signedBy: string; photoRef: string }): JobView {
    const job = requireJob(this.ledger, jobId);
    const rider = requireRider(this.roster, riderId);
    job.deliver(rider.id, proof.signedBy, proof.photoRef, this.clock.now());
    this.ledger.save(job);
    return job.view();
  }
}
