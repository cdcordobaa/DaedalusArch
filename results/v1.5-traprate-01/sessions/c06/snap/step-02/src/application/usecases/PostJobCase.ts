import { DeliveryJob, type JobView } from '../../domain/DeliveryJob';
import { requirePoint, type LatLng } from '../../domain/geo';
import type { PostJob } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';

export class PostJobCase implements PostJob {
  constructor(
    private readonly ledger: JobLedger,
    private readonly clock: Clock,
  ) {}

  run(request: { pickup: LatLng; dropoff: LatLng }): JobView {
    const job = new DeliveryJob(this.ledger.nextId(), requirePoint(request.pickup, 'pickup'), requirePoint(request.dropoff, 'drop-off'), this.clock.now());
    this.ledger.save(job);
    return job.view();
  }
}
