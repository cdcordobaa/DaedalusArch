import { JobStatus } from '../../../domain/job-status';

export interface OwnerNotifierPort {
  notify(ownerId: string, jobId: string, status: JobStatus): Promise<void>;
}
