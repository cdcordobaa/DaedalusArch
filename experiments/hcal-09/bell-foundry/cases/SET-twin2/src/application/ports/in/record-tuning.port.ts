import { CommissionStatus } from '../../../domain/commission-status';
import { FurnaceStep } from '../../../domain/furnace-step';

export interface RecordTuningCommand {
  readonly commissionId: string;
  readonly centsOff: number;
  readonly furnace?: FurnaceStep;
}

export interface RecordTuningResult {
  readonly accepted: boolean;
  readonly status: CommissionStatus;
}

export interface RecordTuningPort {
  record(command: RecordTuningCommand): Promise<RecordTuningResult>;
}
