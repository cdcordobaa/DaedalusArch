import { JobNotFoundError } from '../domain/errors';
import { VesselStage } from '../domain/vessel-stage';
import { RecordMovementCommand, RecordMovementPort } from './ports/in/record-movement.port';
import { AgentNotifierPort } from './ports/out/agent-notifier.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';

const STAGE_BY_PHASE: Record<string, VesselStage> = {
  MOORED: 'alongside',
  UNDERWAY: 'departed',
  DIVERTED: 'abandoned',
  SCRUBBED: 'abandoned',
};

export class RecordMovementUseCase implements RecordMovementPort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly notifier: AgentNotifierPort,
  ) {}

  async record(command: RecordMovementCommand): Promise<void> {
    const job = await this.jobs.findBySlotRef(command.slotRef);
    if (job === null) throw new JobNotFoundError(command.slotRef);
    job.recordMovement(STAGE_BY_PHASE[command.phase] ?? 'approaching');
    await this.jobs.save(job);
    await this.notifier.notify(job.agentId, job.id, job.currentStatus);
  }
}
