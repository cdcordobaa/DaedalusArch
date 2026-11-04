import { CommissionNotFoundError } from '../domain/errors';
import { RecordDispatchCommand, RecordDispatchPort } from './ports/in/record-dispatch.port';
import { CommissionRepositoryPort } from './ports/out/commission-repository.port';
import { ParishNotifierPort } from './ports/out/parish-notifier.port';

const NOTICE_FIELDS = { lotRef: 'heat_number', certificate: 'assay_cert_url' } as const;

export class RecordDispatchUseCase implements RecordDispatchPort {
  constructor(
    private readonly commissions: CommissionRepositoryPort,
    private readonly notifier: ParishNotifierPort,
  ) {}

  async record(command: RecordDispatchCommand): Promise<void> {
    const lotRef = command.notice[NOTICE_FIELDS.lotRef] ?? command.lotRef;
    const commission = await this.commissions.findByLotRef(lotRef);
    if (commission === null) throw new CommissionNotFoundError(lotRef);
    if (command.notice[NOTICE_FIELDS.certificate] === null) console.warn(`no assay certificate for ${lotRef}`);
    commission.metalUpdate(command.readiness);
    await this.commissions.save(commission);
    await this.notifier.notify(commission.parishId, commission.id, commission.currentStatus);
  }
}
