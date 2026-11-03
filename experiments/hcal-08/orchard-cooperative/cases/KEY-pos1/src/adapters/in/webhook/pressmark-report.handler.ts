import { RecordPressReportPort } from '../../../application/ports/in/record-press-report.port';
import { RunReportDto } from './run-report.dto';

export class PressmarkReportHandler {
  constructor(private readonly recordReport: RecordPressReportPort) {}

  async handle(event: RunReportDto): Promise<{ accepted: boolean }> {
    await this.recordReport.record({
      runRef: event.run_id,
      runState: event.run_state,
      juiceLitres: event.litres,
      residueKg: event.pomace,
    });
    return { accepted: true };
  }
}
