import { JobNotFoundError } from '../domain/errors';
import { JobStatus } from '../domain/job-status';
import { RecordMovementCommand, RecordMovementPort } from './ports/in/record-movement.port';
import { AgentNotifierPort } from './ports/out/agent-notifier.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';

const NOTIFY_AGENT: Record<JobStatus, boolean> = {
  REQUESTED: false,
  SCHEDULED: false,
  BOARDED: true,
  COMPLETED: true,
  CANCELLED: true,
};

export class RecordMovementUseCase implements RecordMovementPort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly notifier: AgentNotifierPort,
  ) {}

  async record(command: RecordMovementCommand): Promise<void> {
    const job = await this.jobs.findBySlotRef(command.slotRef);
    if (job === null) throw new JobNotFoundError(command.slotRef);
    job.recordMovement(command.stage);
    await this.jobs.save(job);
    if (NOTIFY_AGENT[job.currentStatus]) await this.notifier.notify(job.agentId, job.id, job.currentStatus);
  }
}
