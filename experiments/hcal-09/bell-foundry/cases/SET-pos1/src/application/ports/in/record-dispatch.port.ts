export interface RecordDispatchCommand {
  readonly lotRef: string;
  readonly dispatchState: string;
}

export interface RecordDispatchPort {
  record(command: RecordDispatchCommand): Promise<void>;
}
