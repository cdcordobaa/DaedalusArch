import { VesselStage } from '../../../domain/vessel-stage';

export interface RecordMovementCommand {
  readonly slotRef: string;
  readonly stage: VesselStage;
  readonly report: Readonly<Record<string, unknown>>;
}

export interface RecordMovementPort {
  record(command: RecordMovementCommand): Promise<void>;
}
