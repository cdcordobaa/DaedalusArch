import { ClearanceState } from '../../../domain/clearance';

export interface FileEntryCommand {
  readonly shipmentId: string;
}

export interface FileEntryResult {
  readonly shipmentId: string;
  readonly state: ClearanceState;
  readonly entryRef: string | null;
  readonly dutyCents: number;
}

export interface FileEntryPort {
  file(command: FileEntryCommand): Promise<FileEntryResult>;
}
