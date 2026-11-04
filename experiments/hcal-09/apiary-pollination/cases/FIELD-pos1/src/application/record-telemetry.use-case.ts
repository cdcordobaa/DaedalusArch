import { PlacementNotFoundError } from '../domain/errors';
import { readingValues } from '../domain/frame-reading';
import { RecordTelemetryCommand, RecordTelemetryPort } from './ports/in/record-telemetry.port';
import { PlacementRepositoryPort } from './ports/out/placement-repository.port';

export class RecordTelemetryUseCase implements RecordTelemetryPort {
  constructor(private readonly placements: PlacementRepositoryPort) {}

  async record(command: RecordTelemetryCommand): Promise<void> {
    const placement = await this.placements.findByYard(command.yardCode);
    if (placement === null) throw new PlacementNotFoundError(command.yardCode);
    const values = readingValues(command.frame);
    placement.recordReading({
      hiveTag: typeof values.hiveTag === 'string' ? values.hiveTag : command.hiveTag,
      vigour: command.vigour,
      broodTempC: typeof values.broodTempC === 'number' ? values.broodTempC : command.broodTempC,
      takenAt: typeof values.takenAt === 'string' ? values.takenAt : command.takenAt,
    });
    await this.placements.save(placement);
  }
}
