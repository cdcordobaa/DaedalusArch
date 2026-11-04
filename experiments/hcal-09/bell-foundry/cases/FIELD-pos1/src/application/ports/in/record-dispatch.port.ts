import { MetalReadiness } from '../../../domain/metal-lot';

export interface RecordDispatchCommand {
  readonly lotRef: string;
  readonly readiness: MetalReadiness;
  readonly notice: Readonly<Record<string, string | null>>;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
