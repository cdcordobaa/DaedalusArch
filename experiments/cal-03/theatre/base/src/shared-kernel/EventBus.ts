import { DomainEvent } from './DomainEvent';

type Handler<E extends DomainEvent> = (event: E) => Promise<void>;

export class EventBus {
  private readonly handlers = new Map<string, Handler<DomainEvent>[]>();

  subscribe<E extends DomainEvent>(name: string, handler: Handler<E>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<DomainEvent>);
    this.handlers.set(name, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers.get(event.name) ?? []) {
      await handler(event);
    }
  }
}
