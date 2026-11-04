import { VesselStage } from '../../../domain/vessel-stage';

export interface RecordMovementCommand {
  readonly slotRef: string;
  readonly stage: VesselStage;
  readonly squat: number;
}

export interface RecordMovementPort {
  record(command: RecordMovementCommand): Promise<void>;
}
