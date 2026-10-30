import { DispatchNotFoundError } from '../domain/errors';
import { palletsFor } from '../domain/freight';
import { manifestLine } from '../domain/manifest';
import { BookFreightCommand, BookFreightPort, BookFreightResult } from './ports/in/book-freight.port';
import { DispatchRepositoryPort } from './ports/out/dispatch-repository.port';
import { FreightCarrierPort } from './ports/out/freight-carrier.port';
import { GardenCentreNotifierPort } from './ports/out/garden-centre-notifier.port';

export class BookFreightUseCase implements BookFreightPort {
  constructor(
    private readonly orders: DispatchRepositoryPort,
    private readonly carrier: FreightCarrierPort,
    private readonly notifier: GardenCentreNotifierPort,
  ) {}

  async book(command: BookFreightCommand): Promise<BookFreightResult> {
    const order = await this.orders.findById(command.dispatchId);
    if (order === null) throw new DispatchNotFoundError(command.dispatchId);
    const booking = await this.carrier.book({
      postcode: order.postcode,
      pallets: palletsFor(order.trays),
      weightKg: order.weightKg,
      collectionDate: command.collectionDate,
    });
    order.bookFreight(booking);
    await this.orders.save(order);
    await this.notifier.notify(order.gardenCentreId, order.id, order.currentStatus);
    return { dispatchId: order.id, status: order.currentStatus, manifest: manifestLine(order) };
  }
}
