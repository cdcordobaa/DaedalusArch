import { RecordTelemetryPort } from '@apiary/application/ports/in/record-telemetry.port';
import { ColonyVigour } from '@apiary/domain/colony';
import { TelemetryFrameDto } from './telemetry.dto';

const VIGOUR_BY_STATE = new Map<string, ColonyVigour>([
  ['thriving', 'strong'],
  ['nominal', 'fair'],
  ['queenless', 'weak'],
  ['swarmed', 'weak'],
]);

export class HivepulseTelemetryHandler {
  constructor(private readonly recordTelemetry: RecordTelemetryPort) {}

  async handle(frame: TelemetryFrameDto): Promise<{ accepted: boolean }> {
    await this.recordTelemetry.record({
      hiveTag: frame.hive_tag,
      yardCode: frame.yard_code,
      vigour: VIGOUR_BY_STATE.get(frame.colony_state) ?? 'lost',
      broodTempC: frame.brood_temp_c,
      takenAt: frame.timestamp,
    });
    return { accepted: true };
  }
}
