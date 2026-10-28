import type { JobView } from '../../domain/DeliveryJob';
import type { RecordPickup } from '../ports/in/Dispatching';
import type { Clock } from '../ports/out/Clock';
import type { JobLedger } from '../ports/out/JobLedger';
import { requireJob } from './lookups';

export class RecordPickupCase implements RecordPickup {
  constructor(
    private readonly ledger: JobLedger,
    private readonly clock: Clock,
  ) {}

  run(jobId: string): JobView {
    const job = requireJob(this.ledger, jobId);
    job.collect(this.clock.now());
    this.ledger.save(job);
    return job.view();
  }
}
