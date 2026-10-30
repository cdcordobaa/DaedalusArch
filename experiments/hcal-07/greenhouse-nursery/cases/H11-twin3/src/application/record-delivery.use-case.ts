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
    if (command.outcome === 'on-van') order.markShipped();
    else if (command.outcome === 'in-transit') return;
    if (command.outcome === 'returned') order.hold();
    else order.markReceived(command.signedBy);
    await this.orders.save(order);
    await this.notifier.notify(order.gardenCentreId, order.id, order.currentStatus);
  }
}
