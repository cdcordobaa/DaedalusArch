import { VisitProgress } from '../../../domain/dispatch';

export interface RecordVisitCommand {
  readonly visitRef: string;
  readonly progress: VisitProgress;
  readonly vendorState: string;
}

export interface RecordVisitPort {
  record(command: RecordVisitCommand): Promise<void>;
}
