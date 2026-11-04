import { JobStatus } from '@harbor/domain/job-status';
import { AgentNotifierPort } from '../../../application/ports/out/agent-notifier.port';

export class ConsoleAgentNotifier implements AgentNotifierPort {
  async notify(agentId: string, jobId: string, status: JobStatus): Promise<void> {
    console.log(`ship's agent ${agentId}: pilotage job ${jobId} is ${status}`);
  }
}
