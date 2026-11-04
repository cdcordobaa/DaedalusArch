import { VesselStage } from '../../../domain/vessel-stage';

export interface RecordMovementCommand {
  readonly slotRef: string;
  readonly stage: VesselStage;
  readonly reportedAt: string;
  readonly atAnchor: boolean;
}

export interface RecordMovementPort {
  record(command: RecordMovementCommand): Promise<void>;
}
