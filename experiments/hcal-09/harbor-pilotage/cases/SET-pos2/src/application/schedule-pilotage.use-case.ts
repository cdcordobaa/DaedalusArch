import { JobNotFoundError } from '../domain/errors';
import { HullCategory } from '../domain/hull-category';
import { SchedulePilotageCommand, SchedulePilotagePort, SchedulePilotageResult } from './ports/in/schedule-pilotage.port';
import { AgentNotifierPort } from './ports/out/agent-notifier.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';
import { TideWindowPort } from './ports/out/tide-window.port';

export class SchedulePilotageUseCase implements SchedulePilotagePort {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly tides: TideWindowPort,
    private readonly notifier: AgentNotifierPort,
  ) {}

  async schedule(command: SchedulePilotageCommand): Promise<SchedulePilotageResult> {
    const job = await this.jobs.findById(command.jobId);
    if (job === null) throw new JobNotFoundError(command.jobId);
    const slot = await this.tides.requestSlot({ vesselImo: job.vesselImo, draughtMetres: job.draughtMetres, etaUtc: job.etaUtc });
    job.schedule(slot, slot.hullClass as HullCategory);
    await this.jobs.save(job);
    await this.notifier.notify(job.agentId, job.id, job.currentStatus);
    return { jobId: job.id, status: job.currentStatus, feeAmount: job.quotedFee?.amount ?? null };
  }
}
