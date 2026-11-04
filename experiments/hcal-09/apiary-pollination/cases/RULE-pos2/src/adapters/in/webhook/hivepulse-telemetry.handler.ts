import { RecordTelemetryPort } from '@apiary/application/ports/in/record-telemetry.port';
import { ColonyVigour } from '@apiary/domain/colony';
import { TelemetryFrameDto } from './telemetry.dto';

export class HivepulseTelemetryHandler {
  constructor(private readonly recordTelemetry: RecordTelemetryPort) {}

  async handle(frame: TelemetryFrameDto): Promise<{ accepted: boolean }> {
    await this.recordTelemetry.record({
      hiveTag: frame.hive_tag,
      yardCode: frame.yard_code,
      vigour: frame.brood_temp_c < 33 && frame.colony_state !== 'silent' ? 'weak' : this.toVigour(frame.colony_state),
      broodTempC: frame.brood_temp_c,
      takenAt: frame.timestamp,
    });
    return { accepted: true };
  }

  private toVigour(state: string): ColonyVigour {
    switch (state) {
      case 'thriving':
        return 'strong';
      case 'nominal':
        return 'fair';
      case 'queenless':
      case 'swarmed':
        return 'weak';
      default:
        return 'lost';
    }
  }
}
