import { JobStatus } from '../../../domain/job-status';

export interface SchedulePilotageCommand {
  readonly jobId: string;
}

export interface SchedulePilotageResult {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly feeAmount: number | null;
}

export interface SchedulePilotagePort {
  schedule(command: SchedulePilotageCommand): Promise<SchedulePilotageResult>;
}
