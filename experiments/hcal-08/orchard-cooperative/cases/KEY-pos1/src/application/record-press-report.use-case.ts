import { LotNotFoundError } from '../domain/errors';
import { PressingProgress } from '../domain/pressing';
import { RecordPressReportCommand, RecordPressReportPort } from './ports/in/record-press-report.port';
import { GrowerNotifierPort } from './ports/out/grower-notifier.port';
import { LotRepositoryPort } from './ports/out/lot-repository.port';

const PROGRESS_BY_RUN_STATE = new Map<string, PressingProgress>([
  ['QUEUED', 'waiting'],
  ['MILLING', 'in-progress'],
  ['PRESSING', 'in-progress'],
  ['SETTLING', 'in-progress'],
  ['BOTTLED', 'finished'],
  ['SPOILED', 'failed'],
]);

export class RecordPressReportUseCase implements RecordPressReportPort {
  constructor(
    private readonly lots: LotRepositoryPort,
    private readonly notifier: GrowerNotifierPort,
  ) {}

  async record(command: RecordPressReportCommand): Promise<void> {
    const lot = await this.lots.findByRunRef(command.runRef);
    if (lot === null) throw new LotNotFoundError(command.runRef);
    const progress = PROGRESS_BY_RUN_STATE.get(command.runState) ?? 'in-progress';
    lot.recordProgress(progress, command.juiceLitres, command.residueKg);
    await this.lots.save(lot);
    await this.notifier.notify(lot.growerId, lot.id, lot.currentStatus);
  }
}
