import { PressingProgress } from '../../../domain/pressing';

export interface RecordPressReportCommand {
  readonly runRef: string;
  readonly progress: PressingProgress;
  readonly juiceLitres: number;
  readonly residueKg: number;
}

export interface RecordPressReportPort {
  record(command: RecordPressReportCommand): Promise<void>;
}
