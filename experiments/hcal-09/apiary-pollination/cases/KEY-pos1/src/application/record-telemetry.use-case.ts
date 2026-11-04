import { ColonyVigour } from '../domain/colony';
import { PlacementNotFoundError } from '../domain/errors';
import { RecordTelemetryCommand, RecordTelemetryPort } from './ports/in/record-telemetry.port';
import { PlacementRepositoryPort } from './ports/out/placement-repository.port';

export class RecordTelemetryUseCase implements RecordTelemetryPort {
  constructor(private readonly placements: PlacementRepositoryPort) {}

  async record(command: RecordTelemetryCommand): Promise<void> {
    const placement = await this.placements.findByYard(command.yardCode);
    if (placement === null) throw new PlacementNotFoundError(command.yardCode);
    placement.recordReading({ hiveTag: command.hiveTag, vigour: this.vigourOf(command), broodTempC: command.broodTempC, takenAt: command.takenAt });
    await this.placements.save(placement);
  }

  private vigourOf(command: RecordTelemetryCommand): ColonyVigour {
    if (command.colonyState === 'thriving') return 'strong';
    if (command.colonyState === 'nominal') return 'fair';
    if (command.colonyState === 'queenless' || command.colonyState === 'swarmed') return 'weak';
    return 'lost';
  }
}
