export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}

export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void;

export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe<E extends DomainEvent>(name: string, handler: EventHandler<E>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as EventHandler);
    this.handlers.set(name, list);
  }

  publish(events: readonly DomainEvent[]): void {
    for (const event of events) {
      for (const handler of this.handlers.get(event.name) ?? []) {
        handler(event);
      }
    }
  }
}
