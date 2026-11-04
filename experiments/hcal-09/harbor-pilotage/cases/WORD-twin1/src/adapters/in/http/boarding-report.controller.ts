import { LogSquatPort } from '../../../application/ports/in/log-squat.port';

export class BoardingReportController {
  constructor(private readonly logSquat: LogSquatPort) {}

  async postSquat(params: { jobId: string; squatMetres: number }): Promise<{ logged: boolean }> {
    await this.logSquat.log({ jobId: params.jobId, squatMetres: params.squatMetres });
    return { logged: true };
  }
}
