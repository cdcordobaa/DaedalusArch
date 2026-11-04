import { RecordTelemetryPort } from '@apiary/application/ports/in/record-telemetry.port';
import { TelemetryFrameDto } from './telemetry.dto';

export class HivepulseTelemetryHandler {
  constructor(private readonly recordTelemetry: RecordTelemetryPort) {}

  async handle(frame: TelemetryFrameDto): Promise<{ accepted: boolean }> {
    await this.recordTelemetry.record({
      hiveTag: frame.hive_tag,
      yardCode: frame.yard_code,
      colonyState: frame.colony_state,
      broodTempC: frame.brood_temp_c,
      takenAt: frame.timestamp,
    });
    return { accepted: true };
  }
}
