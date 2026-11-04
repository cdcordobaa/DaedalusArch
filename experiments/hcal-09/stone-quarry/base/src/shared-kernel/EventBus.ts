import { DomainEvent } from './DomainEvent';

export type EventHandler<E extends DomainEvent> = (event: E) => Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler<DomainEvent>[]>();

  subscribe<E extends DomainEvent>(type: E['type'], handler: EventHandler<E>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers.get(event.type) ?? []) await handler(event);
  }
}
