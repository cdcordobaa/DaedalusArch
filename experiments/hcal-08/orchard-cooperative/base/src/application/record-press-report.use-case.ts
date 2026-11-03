import { LotNotFoundError } from '../domain/errors';
import { RecordPressReportCommand, RecordPressReportPort } from './ports/in/record-press-report.port';
import { GrowerNotifierPort } from './ports/out/grower-notifier.port';
import { LotRepositoryPort } from './ports/out/lot-repository.port';

export class RecordPressReportUseCase implements RecordPressReportPort {
  constructor(
    private readonly lots: LotRepositoryPort,
    private readonly notifier: GrowerNotifierPort,
  ) {}

  async record(command: RecordPressReportCommand): Promise<void> {
    const lot = await this.lots.findByRunRef(command.runRef);
    if (lot === null) throw new LotNotFoundError(command.runRef);
    lot.recordProgress(command.progress, command.juiceLitres, command.residueKg);
    await this.lots.save(lot);
    await this.notifier.notify(lot.growerId, lot.id, lot.currentStatus);
  }
}
