import type { JobService } from '../business/services/JobService';
import type { MechanicService } from '../business/services/MechanicService';
import { handle, type HttpResponse } from './HttpResponse';

/** POST /mechanics, POST /jobs, POST /jobs/:id/close, GET /jobs/:id. */
export class WorkshopController {
  constructor(
    private readonly mechanics: MechanicService,
    private readonly jobs: JobService,
    private readonly today: () => string,
  ) {}

  hire(name: string): HttpResponse {
    return handle(() => this.mechanics.hire(name));
  }

  openJob(plate: string, mechanicId: string): HttpResponse {
    return handle(() => this.jobs.open(plate, mechanicId, this.today()));
  }

  closeJob(jobId: string, labourMinutes: number, partsCents: number): HttpResponse {
    return handle(() => this.jobs.close(jobId, labourMinutes, partsCents, this.today()));
  }

  job(jobId: string): HttpResponse {
    return handle(() => this.jobs.job(jobId));
  }
}
