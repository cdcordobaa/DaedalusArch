import { VesselStage } from '../../../domain/vessel-stage';

export interface RecordMovementCommand {
  readonly slotRef: string;
  readonly stage: VesselStage;
  readonly reported_at_utc: string;
}

export interface RecordMovementPort {
  record(command: RecordMovementCommand): Promise<void>;
}
