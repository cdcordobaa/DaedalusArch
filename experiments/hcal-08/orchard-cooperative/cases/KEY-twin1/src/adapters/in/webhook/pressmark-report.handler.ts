import { RecordPressReportPort } from '../../../application/ports/in/record-press-report.port';
import { PressingProgress } from '../../../domain/pressing';
import { RunReportDto } from './run-report.dto';

const PROGRESS_BY_RUN_STATE = new Map<string, PressingProgress>([
  ['QUEUED', 'waiting'],
  ['MILLING', 'in-progress'],
  ['PRESSING', 'in-progress'],
  ['SETTLING', 'in-progress'],
  ['BOTTLED', 'finished'],
  ['SPOILED', 'failed'],
]);

export class PressmarkReportHandler {
  constructor(private readonly recordReport: RecordPressReportPort) {}

  async handle(event: RunReportDto): Promise<{ accepted: boolean }> {
    await this.recordReport.record({
      runRef: event.run_id,
      progress: PROGRESS_BY_RUN_STATE.get(event.run_state) ?? 'in-progress',
      juiceLitres: event.litres,
      residueKg: event.pomace,
    });
    return { accepted: true };
  }
}
