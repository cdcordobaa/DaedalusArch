import { MetalReadiness } from '../../../domain/metal-lot';

export interface RecordDispatchCommand {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly carrier: string;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
