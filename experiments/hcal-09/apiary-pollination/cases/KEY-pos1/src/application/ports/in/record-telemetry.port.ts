export interface RecordTelemetryCommand {
  readonly hiveTag: string;
  readonly yardCode: string;
  readonly colonyState: string;
  readonly broodTempC: number;
  readonly takenAt: string;
}

export interface RecordTelemetryPort {
  record(command: RecordTelemetryCommand): Promise<void>;
}
