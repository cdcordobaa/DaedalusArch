import { PlacementNotFoundError } from '../domain/errors';
import { HiveCondition } from '../domain/hive-condition';
import { RecordTelemetryCommand, RecordTelemetryPort } from './ports/in/record-telemetry.port';
import { PlacementRepositoryPort } from './ports/out/placement-repository.port';

export class RecordTelemetryUseCase implements RecordTelemetryPort {
  constructor(private readonly placements: PlacementRepositoryPort) {}

  async record(command: RecordTelemetryCommand): Promise<void> {
    const placement = await this.placements.findByYard(command.yardCode);
    if (placement === null) throw new PlacementNotFoundError(command.yardCode);
    placement.recordReading({ hiveTag: command.hiveTag, condition: command.colonyState as HiveCondition, broodTempC: command.broodTempC, takenAt: command.takenAt });
    await this.placements.save(placement);
  }
}
