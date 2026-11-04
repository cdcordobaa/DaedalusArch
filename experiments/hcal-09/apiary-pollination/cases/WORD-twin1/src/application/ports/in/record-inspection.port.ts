export interface RecordInspectionCommand {
  readonly placementId: string;
  readonly hiveTag: string;
  readonly inspector: string;
}

export interface RecordInspectionPort {
  record(command: RecordInspectionCommand): Promise<void>;
}
