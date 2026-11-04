import { JobNotFoundError } from '../domain/errors';
import { RecordMovementCommand, RecordMovementPort } from './ports/in/record-movement.port';
import { AgentNotifierPort } from './ports/out/agent-notifier.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';

export class RecordMovementUseCase implements RecordMovementPort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly notifier: AgentNotifierPort,
  ) {}

  async record(command: RecordMovementCommand): Promise<void> {
    const job = await this.jobs.findBySlotRef(command.slotRef);
    if (job === null) throw new JobNotFoundError(command.slotRef);
    job.recordMovement(command.stage, command.squat);
    await this.jobs.save(job);
    await this.notifier.notify(job.agentId, job.id, job.currentStatus);
  }
}
