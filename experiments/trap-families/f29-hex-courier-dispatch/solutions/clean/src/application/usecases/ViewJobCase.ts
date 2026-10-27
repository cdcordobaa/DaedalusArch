import type { JobView } from '../../domain/DeliveryJob';
import type { ViewJob } from '../ports/in/Dispatching';
import type { JobLedger } from '../ports/out/JobLedger';
import { requireJob } from './lookups';

export class ViewJobCase implements ViewJob {
  constructor(private readonly ledger: JobLedger) {}

  run(jobId: string): JobView {
    return requireJob(this.ledger, jobId).view();
  }
}
