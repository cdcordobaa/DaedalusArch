import { PlacementNotFoundError } from '../domain/errors';
import { RecordInspectionCommand, RecordInspectionPort } from './ports/in/record-inspection.port';
import { PlacementRepositoryPort } from './ports/out/placement-repository.port';

export class RecordInspectionUseCase implements RecordInspectionPort {
  constructor(private readonly placements: PlacementRepositoryPort) {}

  async record(command: RecordInspectionCommand): Promise<void> {
    const placement = await this.placements.findById(command.placementId);
    if (placement === null) throw new PlacementNotFoundError(command.placementId);
    placement.markQueenless(command.hiveTag);
    await this.placements.save(placement);
  }
}
