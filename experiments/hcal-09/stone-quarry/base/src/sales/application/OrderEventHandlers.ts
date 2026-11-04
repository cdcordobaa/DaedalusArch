import { HaulRecorded } from '../../haulage';
import { EventBus } from '../../shared-kernel/EventBus';
import { OrderService } from './OrderService';

export function subscribeOrderHandlers(bus: EventBus, orders: OrderService): void {
  bus.subscribe<HaulRecorded>('haulage.HaulRecorded', async (event) => {
    await orders.recordDelivery(event.orderId, event.tonnes);
  });
}
