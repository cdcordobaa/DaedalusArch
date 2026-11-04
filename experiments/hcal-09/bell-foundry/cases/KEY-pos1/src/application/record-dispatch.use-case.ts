import { CommissionNotFoundError } from '../domain/errors';
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
    commission.dispatchUpdate(command.dispatchState);
    await this.commissions.save(commission);
    await this.notifier.notify(commission.parishId, commission.id, commission.currentStatus);
  }
}
