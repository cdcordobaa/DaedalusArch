import { JobNotFoundError } from '../domain/errors';
import { LogSquatCommand, LogSquatPort } from './ports/in/log-squat.port';
import { JobRepositoryPort } from './ports/out/job-repository.port';

export class LogSquatUseCase implements LogSquatPort {
  constructor(private readonly jobs: JobRepositoryPort) {}

  async log(command: LogSquatCommand): Promise<void> {
    const job = await this.jobs.findById(command.jobId);
    if (job === null) throw new JobNotFoundError(command.jobId);
    job.logSquat(command.squatMetres);
    await this.jobs.save(job);
  }
}
