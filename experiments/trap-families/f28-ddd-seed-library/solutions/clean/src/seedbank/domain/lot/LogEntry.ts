export type LogEntryKind = 'donated' | 'taken' | 'shared-out' | 'shared-in';

export interface LogEntry {
  readonly entry: LogEntryKind;
  readonly grams: number;
  readonly otherLot: string | null;
}
