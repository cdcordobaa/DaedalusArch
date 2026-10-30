import { ProductionStage } from '../../../domain/production-stage';

export interface RecordDispatchCommand {
  readonly productionRef: string;
  readonly trackingRef: string | null;
  readonly stage: ProductionStage;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
