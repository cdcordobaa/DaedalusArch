/** Where an order stands, in terms the client understands. */
export type OrderStage = 'RECEIVED' | 'FINDING_TRANSLATOR' | 'IN_TRANSLATION' | 'READY_TO_DOWNLOAD' | 'ON_HOLD';

/** The marketplace job behind an order, as the staff job card shows it. */
export interface JobSnapshot {
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  readonly stage: OrderStage;
  readonly updatedAt: string;
}
