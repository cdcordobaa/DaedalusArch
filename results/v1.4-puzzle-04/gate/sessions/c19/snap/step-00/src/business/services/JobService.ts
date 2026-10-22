import type { JobGateway } from '../../persistence/JobGateway';
import { WorkshopError } from '../errors/WorkshopError';
import { normalisePlate, toView, type JobView } from '../model/Job';
import type { MechanicService } from './MechanicService';

export class JobService {
  constructor(
    private readonly jobs: JobGateway,
    private readonly mechanics: MechanicService,
  ) {}

  open(plate: string, mechanicId: string, today: string): JobView {
    const p = normalisePlate(plate);
    if (p === null) throw new WorkshopError(`not a number plate: ${plate}`);
    this.mechanics.mechanic(mechanicId);
    return toView(this.jobs.insert({ plate: p, mechanicId, openedOn: today, closedOn: null, labourMinutes: 0, partsCents: 0 }));
  }

  close(jobId: string, labourMinutes: number, partsCents: number, today: string): JobView {
    const job = this.jobs.byId(jobId);
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    if (job.closedOn !== null) throw new WorkshopError(`job ${jobId} is closed`);
    if (!Number.isInteger(labourMinutes) || labourMinutes < 0) throw new WorkshopError('labour minutes must be a whole number, 0 or more');
    if (!Number.isInteger(partsCents) || partsCents < 0) throw new WorkshopError('parts must be a whole number of cents, 0 or more');
    const closed = { ...job, closedOn: today, labourMinutes, partsCents };
    this.jobs.update(closed);
    return toView(closed);
  }

  job(jobId: string): JobView {
    const job = this.jobs.byId(jobId);
    if (job === undefined) throw new WorkshopError(`no job ${jobId}`);
    return toView(job);
  }
}
