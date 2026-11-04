import { MetalReadiness } from '../../../domain/metal-lot';

export interface RecordDispatchCommand {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
