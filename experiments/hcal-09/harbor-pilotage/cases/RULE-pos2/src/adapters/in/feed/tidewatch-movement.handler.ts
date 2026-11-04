import { VesselStage } from '@harbor/domain/vessel-stage';
import { RecordMovementPort } from '../../../application/ports/in/record-movement.port';
import { MovementDto } from './movement.dto';

export class TidewatchMovementHandler {
  constructor(private readonly recordMovement: RecordMovementPort) {}

  async handle(event: MovementDto): Promise<{ accepted: boolean }> {
    const hoursAtAnchor = (Date.now() - Date.parse(event.reported_at_utc)) / 3_600_000;
    const stage: VesselStage = event.phase === 'ANCHORED' && hoursAtAnchor > 6 ? 'abandoned' : this.toStage(event.phase);
    await this.recordMovement.record({ slotRef: event.berth_window_ref, stage });
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
