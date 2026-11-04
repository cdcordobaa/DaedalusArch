/** The marketplace job behind an order, as the staff job card shows it. */
import type { ProgressStage } from './ProgressStage';

export interface JobSnapshot {
  /** The customer-facing stage, translated from the marketplace state by the adapter. */
  readonly stage: ProgressStage;
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  readonly updatedAt: string;
}
