import type { FulfilmentSagaRepository } from '../domain/fulfilment/FulfilmentSagaRepository';
import type { OrderRepository } from '../domain/order/OrderRepository';

/** A plain command that advances the saga and changes the order itself in the same flow. */
export class CompleteShipment {
  constructor(private readonly sagas: FulfilmentSagaRepository, private readonly orders: OrderRepository) {}

  async execute(orderId: string): Promise<void> {
    const saga = await this.sagas.byId(orderId);
    const order = await this.orders.byId(orderId);
    if (saga === undefined || order === undefined) throw new Error(`unknown order ${orderId}`);
    saga.shipped();
    order.markShipped();
    await this.sagas.save(saga);
    await this.orders.save(order);
  }
}
