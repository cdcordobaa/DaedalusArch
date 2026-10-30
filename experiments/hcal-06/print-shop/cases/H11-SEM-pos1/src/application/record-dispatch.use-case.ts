import { OrderNotFoundError } from '../domain/errors';
import { RecordDispatchCommand, RecordDispatchPort } from './ports/in/record-dispatch.port';
import { CustomerNotifierPort } from './ports/out/customer-notifier.port';
import { OrderRepositoryPort } from './ports/out/order-repository.port';

export class RecordDispatchUseCase implements RecordDispatchPort {
  constructor(
    private readonly orders: OrderRepositoryPort,
    private readonly notifier: CustomerNotifierPort,
  ) {}

  async record(command: RecordDispatchCommand): Promise<void> {
    const order = await this.orders.findByProductionRef(command.productionRef);
    if (order === null) throw new OrderNotFoundError(command.productionRef);
    order.advance(command.stage, command.trackingRef);
    await this.orders.save(order);
    await this.notifier.notify(order.customerId, order.id, order.currentStatus);
  }
}
