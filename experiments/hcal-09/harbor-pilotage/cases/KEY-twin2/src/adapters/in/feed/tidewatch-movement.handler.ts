import { VesselStage } from '@harbor/domain/vessel-stage';
import { RecordMovementPort } from '../../../application/ports/in/record-movement.port';
import { MovementDto } from './movement.dto';

const STAGE_BY_PHASE: Record<string, VesselStage> = {
  MOORED: 'alongside',
  UNDERWAY: 'departed',
  DIVERTED: 'abandoned',
  SCRUBBED: 'abandoned',
};

export class TidewatchMovementHandler {
  constructor(private readonly recordMovement: RecordMovementPort) {}

  async handle(event: MovementDto): Promise<{ accepted: boolean }> {
    await this.recordMovement.record({ slotRef: event.berth_window_ref, stage: STAGE_BY_PHASE[event.phase] ?? 'approaching' });
    return { accepted: true };
  }
}
