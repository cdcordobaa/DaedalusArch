import { VesselStage } from '@harbor/domain/vessel-stage';
import { RecordMovementPort } from '../../../application/ports/in/record-movement.port';
import { MovementDto } from './movement.dto';

export class TidewatchMovementHandler {
  constructor(private readonly recordMovement: RecordMovementPort) {}

  async handle(event: MovementDto): Promise<{ accepted: boolean }> {
    await this.recordMovement.record({ slotRef: event.berth_window_ref, stage: this.toStage(event.phase), reported_at_utc: event.reported_at_utc });
    return { accepted: true };
  }

  private toStage(phase: string): VesselStage {
    switch (phase) {
      case 'MOORED':
        return 'alongside';
      case 'UNDERWAY':
        return 'departed';
      case 'DIVERTED':
      case 'SCRUBBED':
        return 'abandoned';
      default:
        return 'approaching';
    }
  }
}
