import { DispatchNotFoundError } from '../domain/errors';
import { RecordDeliveryCommand, RecordDeliveryPort } from './ports/in/record-delivery.port';
import { DispatchRepositoryPort } from './ports/out/dispatch-repository.port';
import { GardenCentreNotifierPort } from './ports/out/garden-centre-notifier.port';

export class RecordDeliveryUseCase implements RecordDeliveryPort {
  constructor(
    private readonly orders: DispatchRepositoryPort,
    private readonly notifier: GardenCentreNotifierPort,
  ) {}

  async record(command: RecordDeliveryCommand): Promise<void> {
    const order = await this.orders.findByFreightRef(command.freightRef);
    if (order === null) throw new DispatchNotFoundError(command.freightRef);
    if (!order.track(command.stage)) return;
    await this.orders.save(order);
    await this.notifier.notify(order.gardenCentreId, order.id, order.currentStatus);
  }
}
