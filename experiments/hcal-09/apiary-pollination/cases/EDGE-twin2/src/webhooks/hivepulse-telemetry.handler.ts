import { RecordTelemetryPort } from '@apiary/application/ports/in/record-telemetry.port';
import { ColonyVigour } from '@apiary/domain/colony';
import { verifyFrame } from 'hivepulse-sdk';
import { TelemetryFrameDto } from '../adapters/in/webhook/telemetry.dto';

export class HivepulseTelemetryHandler {
  constructor(private readonly recordTelemetry: RecordTelemetryPort) {}

  async handle(frame: TelemetryFrameDto, signature: string): Promise<{ accepted: boolean }> {
    if (!verifyFrame(JSON.stringify(frame), signature)) return { accepted: false };
    await this.recordTelemetry.record({
      hiveTag: frame.hive_tag,
      yardCode: frame.yard_code,
      vigour: this.toVigour(frame.colony_state),
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
