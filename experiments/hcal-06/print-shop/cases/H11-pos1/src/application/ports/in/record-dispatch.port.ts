export interface RecordDispatchCommand {
  readonly productionRef: string;
  readonly trackingRef: string | null;
  readonly jobStatus: string;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
