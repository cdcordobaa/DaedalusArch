export interface RecordMovementCommand {
  readonly slotRef: string;
  readonly phase: string;
}

export interface RecordMovementPort {
  record(command: RecordMovementCommand): Promise<void>;
}
