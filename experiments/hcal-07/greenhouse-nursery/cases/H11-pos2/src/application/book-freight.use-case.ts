import { DispatchNotFoundError, FreightRefusedError } from '../domain/errors';
import { nextDay, palletsFor } from '../domain/freight';
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
    const request = {
      postcode: order.postcode,
      pallets: palletsFor(order.trays),
      weightKg: order.weightKg,
      collectionDate: command.collectionDate,
    };
    let booking;
    try {
      booking = await this.carrier.book(request);
    } catch (e) {
      if (!(e instanceof FreightRefusedError && e.carrierCode === 'RJ_NO_COLLECTION_SLOT')) throw e;
      booking = await this.carrier.book({ ...request, collectionDate: nextDay(command.collectionDate) });
    }
    order.bookFreight(booking);
    await this.orders.save(order);
    await this.notifier.notify(order.gardenCentreId, order.id, order.currentStatus);
    return { dispatchId: order.id, status: order.currentStatus };
  }
}
