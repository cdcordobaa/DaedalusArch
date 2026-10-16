import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBus } from '@nestjs/cqrs';
import { bus } from '../shared/bus';
import { OrderShipped } from '../shared/events';
import { Logger } from './logger';

export class OrderService {
  constructor(
    private readonly events: EventEmitter2,
    private readonly eventBus: EventBus,
    private readonly log: Logger,
  ) {}

  // AS1: node EventEmitter channel 'order.placed' (subscriber: billing; allowed subscriber: audit-log).
  place(id: string): void {
    bus.emit('order.placed', id);
  }

  // AS2: @nestjs/event-emitter channel 'order.cancelled' (subscriber: notifications, via @OnEvent).
  cancel(id: string): void {
    this.events.emit('order.cancelled', { id });
  }

  // AS5: @nestjs/cqrs event OrderShipped (subscriber: notifications, via @EventsHandler).
  ship(id: string): void {
    this.eventBus.publish(new OrderShipped(id));
  }

  // NM-AS1: a computed event name: no channel.
  relay(eventName: string, id: string): void {
    bus.emit(eventName, id);
  }

  // NM-AS2: not an emitter.
  trace(id: string): void {
    this.log.emit(`order.placed ${id}`);
  }

  // NM-AS3 (publisher half): published and consumed inside the orders module.
  audit(id: string): void {
    bus.emit('order.audited', id);
  }
}
