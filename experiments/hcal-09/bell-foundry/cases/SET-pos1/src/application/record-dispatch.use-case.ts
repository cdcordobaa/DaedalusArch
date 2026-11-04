import { CommissionNotFoundError } from '../domain/errors';
import { DispatchStep } from './dispatch-steps';
import { RecordDispatchCommand, RecordDispatchPort } from './ports/in/record-dispatch.port';
import { CommissionRepositoryPort } from './ports/out/commission-repository.port';
import { ParishNotifierPort } from './ports/out/parish-notifier.port';

export class RecordDispatchUseCase implements RecordDispatchPort {
  constructor(
    private readonly commissions: CommissionRepositoryPort,
    private readonly notifier: ParishNotifierPort,
  ) {}

  async record(command: RecordDispatchCommand): Promise<void> {
    const commission = await this.commissions.findByLotRef(command.lotRef);
    if (commission === null) throw new CommissionNotFoundError(command.lotRef);
    const step = command.dispatchState as DispatchStep;
    if (step === 'LANDED') commission.metalUpdate('arrived');
    else if (step === 'REJECTED') commission.metalUpdate('refused');
    else if (step === 'LOADED') commission.metalUpdate('shipped');
    await this.commissions.save(commission);
    await this.notifier.notify(commission.parishId, commission.id, commission.currentStatus);
  }
}
