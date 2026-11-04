/** How far an order has come, in the words the client sees. */
export type OrderStage = 'FINDING_TRANSLATOR' | 'IN_TRANSLATION' | 'READY_TO_DOWNLOAD' | 'ON_HOLD';

/** The marketplace job behind an order, as the staff job card shows it. */
export interface JobSnapshot {
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  /** The same state in the bureau's own terms. */
  readonly stage: OrderStage;
  readonly updatedAt: string;
}
