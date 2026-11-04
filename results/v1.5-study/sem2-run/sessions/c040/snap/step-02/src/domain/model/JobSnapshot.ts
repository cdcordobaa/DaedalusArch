/** Where a client's translation is, in the bureau's own words. */
export type JobStage = 'FINDING_TRANSLATOR' | 'IN_TRANSLATION' | 'READY_TO_DOWNLOAD' | 'ON_HOLD';

/** The marketplace job behind an order, as the staff job card shows it. */
export interface JobSnapshot {
  readonly stage: JobStage;
  readonly jobId: string;
  readonly translator: string | null;
  /** The marketplace's own word for where the job is, printed on the job card as is. */
  readonly stateCode: string;
  readonly updatedAt: string;
}
