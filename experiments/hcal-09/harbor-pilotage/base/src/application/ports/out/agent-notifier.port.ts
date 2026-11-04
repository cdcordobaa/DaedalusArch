import { JobStatus } from '../../../domain/job-status';

export interface AgentNotifierPort {
  notify(agentId: string, jobId: string, status: JobStatus): Promise<void>;
}
