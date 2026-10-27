export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
}

export type EventHandler<E extends DomainEvent> = (event: E) => Promise<void> | void;

export interface EventBus {
  publish(events: readonly DomainEvent[]): Promise<void>;
  subscribe<E extends DomainEvent>(type: E["type"], handler: EventHandler<E>): void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<EventHandler<DomainEvent>>>();

  subscribe<E extends DomainEvent>(type: E["type"], handler: EventHandler<E>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(type, list);
  }

  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) {
        await handler(event);
      }
    }
  }
}
