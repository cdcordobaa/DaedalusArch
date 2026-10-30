import { ProductionPhase } from '../../../domain/production-phase';

export interface RecordDispatchCommand {
  readonly productionRef: string;
  readonly trackingRef: string | null;
  readonly phase: ProductionPhase;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
