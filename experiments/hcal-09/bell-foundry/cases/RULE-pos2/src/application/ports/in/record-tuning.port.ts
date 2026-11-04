import { CommissionStatus } from '../../../domain/commission-status';

export interface RecordTuningCommand {
  readonly commissionId: string;
  readonly centsOff: number;
  readonly accepted: boolean;
}

export interface RecordTuningResult {
  readonly accepted: boolean;
  readonly status: CommissionStatus;
}

export interface RecordTuningPort {
  record(command: RecordTuningCommand): Promise<RecordTuningResult>;
}
