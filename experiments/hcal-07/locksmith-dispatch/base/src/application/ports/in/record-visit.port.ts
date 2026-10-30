import { VisitProgress } from '../../../domain/dispatch';

export interface RecordVisitCommand {
  readonly visitRef: string;
  readonly progress: VisitProgress;
}

export interface RecordVisitPort {
  record(command: RecordVisitCommand): Promise<void>;
}
