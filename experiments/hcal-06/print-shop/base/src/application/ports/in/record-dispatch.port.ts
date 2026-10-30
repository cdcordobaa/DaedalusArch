export interface RecordDispatchCommand {
  readonly productionRef: string;
  readonly trackingRef: string | null;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
