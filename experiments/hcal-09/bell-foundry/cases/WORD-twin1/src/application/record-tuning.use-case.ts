import { CommissionNotFoundError } from '../domain/errors';
import { RecordTuningCommand, RecordTuningPort, RecordTuningResult } from './ports/in/record-tuning.port';
import { CommissionRepositoryPort } from './ports/out/commission-repository.port';

export class RecordTuningUseCase implements RecordTuningPort {
  constructor(private readonly commissions: CommissionRepositoryPort) {}

  async record(command: RecordTuningCommand): Promise<RecordTuningResult> {
    const commission = await this.commissions.findById(command.commissionId);
    if (commission === null) throw new CommissionNotFoundError(command.commissionId);
    const accepted = commission.recordTuning(command.centsOff);
    if (command.tinPercent !== undefined) commission.recordAssay(command.tinPercent);
    await this.commissions.save(commission);
    return { accepted, status: commission.currentStatus };
  }
}
