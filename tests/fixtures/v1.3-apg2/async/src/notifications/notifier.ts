import { OnEvent } from '@nestjs/event-emitter';
import { EventsHandler } from '@nestjs/cqrs';
import { OrderShipped } from '../shared/events';

export class Notifier {
  // AS2 (subscriber half).
  @OnEvent('order.cancelled')
  onCancelled(payload: { id: string }): void {
    void payload;
  }
}

// AS5 (subscriber half).
@EventsHandler(OrderShipped)
export class ShippedHandler {
  handle(event: OrderShipped): void {
    void event;
  }
}
