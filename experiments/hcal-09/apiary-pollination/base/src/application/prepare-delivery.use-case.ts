import { PlacementNotFoundError } from '../domain/errors';
import { sensorUnitsFor } from '../domain/stocking';
import { PrepareDeliveryCommand, PrepareDeliveryPort, PrepareDeliveryResult } from './ports/in/prepare-delivery.port';
import { GrowerNotifierPort } from './ports/out/grower-notifier.port';
import { PlacementRepositoryPort } from './ports/out/placement-repository.port';
import { SensorLeasePort } from './ports/out/sensor-lease.port';

export class PrepareDeliveryUseCase implements PrepareDeliveryPort {
  constructor(
    private readonly placements: PlacementRepositoryPort,
    private readonly sensors: SensorLeasePort,
    private readonly notifier: GrowerNotifierPort,
  ) {}

  async prepare(command: PrepareDeliveryCommand): Promise<PrepareDeliveryResult> {
    const placement = await this.placements.findById(command.placementId);
    if (placement === null) throw new PlacementNotFoundError(command.placementId);
    const cover = await this.sensors.lease({ yardCode: placement.yardCode, units: sensorUnitsFor(placement.hiveCount) });
    placement.attachSensors(cover);
    await this.placements.save(placement);
    await this.notifier.notify(placement.growerId, placement.id, placement.currentStatus);
    return { placementId: placement.id, status: placement.currentStatus, hiveCount: placement.hiveCount };
  }
}
