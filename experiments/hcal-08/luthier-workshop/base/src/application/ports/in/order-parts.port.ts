import { JobStatus } from '../../../domain/job-status';

export interface OrderPartsCommand {
  readonly jobId: string;
}

export interface OrderPartsResult {
  readonly jobId: string;
  readonly status: JobStatus;
}

export interface OrderPartsPort {
  order(command: OrderPartsCommand): Promise<OrderPartsResult>;
}
