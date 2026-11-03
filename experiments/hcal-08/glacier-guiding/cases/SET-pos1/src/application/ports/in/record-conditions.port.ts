export interface RecordConditionsCommand {
  readonly routeCode: string;
  readonly band: string;
}

export interface RecordConditionsPort {
  record(command: RecordConditionsCommand): Promise<number>;
}
