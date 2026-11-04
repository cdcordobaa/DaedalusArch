import type { JobSnapshot } from '../../../../domain/model/JobSnapshot';

/** Where a posted job is, in the bureau's own terms. */
export interface JobLookup {
  snapshot(jobId: string): Promise<JobSnapshot>;
}
