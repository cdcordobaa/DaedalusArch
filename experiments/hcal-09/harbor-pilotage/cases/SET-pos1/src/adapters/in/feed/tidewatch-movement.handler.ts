import { RecordMovementPort } from '../../../application/ports/in/record-movement.port';
import { MovementDto } from './movement.dto';

export class TidewatchMovementHandler {
  constructor(private readonly recordMovement: RecordMovementPort) {}

  async handle(event: MovementDto): Promise<{ accepted: boolean }> {
    await this.recordMovement.record({ slotRef: event.berth_window_ref, phase: event.phase });
    return { accepted: true };
  }
}
