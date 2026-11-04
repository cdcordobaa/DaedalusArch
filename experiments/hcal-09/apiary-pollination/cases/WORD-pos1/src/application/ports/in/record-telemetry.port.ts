import { ColonyVigour } from '../../../domain/colony';

export interface RecordTelemetryCommand {
  readonly hiveTag: string;
  readonly yardCode: string;
  readonly vigour: ColonyVigour;
  readonly broodTempC: number;
  readonly takenAt: string;
  readonly firmware: string;
}

export interface RecordTelemetryPort {
  record(command: RecordTelemetryCommand): Promise<void>;
}
