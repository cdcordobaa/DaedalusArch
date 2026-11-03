import { RecordPressReportPort } from '../../../application/ports/in/record-press-report.port';
import { PressingProgress } from '../../../domain/pressing';
import { RunReportDto } from './run-report.dto';

export class PressmarkReportHandler {
  constructor(private readonly recordReport: RecordPressReportPort) {}

  async handle(event: RunReportDto): Promise<{ accepted: boolean }> {
    await this.recordReport.record({
      runRef: event.run_id,
      progress: this.toProgress(event.run_state),
      juiceLitres: event.litres,
      residueKg: event.pomace,
    });
    return { accepted: true };
  }

  private toProgress(runState: string): PressingProgress {
    if (runState === 'BOTTLED') return 'finished';
    if (runState === 'SPOILED') return 'failed';
    if (runState === 'QUEUED') return 'waiting';
    return 'in-progress';
  }
}
