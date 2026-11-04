import type { JobStage } from '../services/ProgressStage';

/** The marketplace job behind an order, as the staff job card shows it. */
export interface JobSnapshot {
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  /** The bureau's own stage for the job, decided by the adapter from the marketplace state. */
  readonly stage: JobStage;
  readonly updatedAt: string;
}
