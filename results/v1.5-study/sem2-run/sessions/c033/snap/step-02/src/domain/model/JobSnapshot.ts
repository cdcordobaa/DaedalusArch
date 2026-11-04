import type { ProgressStage } from '../services/ProgressStage';

/** The marketplace job behind an order, as the staff job card shows it. */
export interface JobSnapshot {
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  /** The stage the customer sees, decided by the adapter from the marketplace's state. */
  readonly stage: ProgressStage;
  readonly updatedAt: string;
}
