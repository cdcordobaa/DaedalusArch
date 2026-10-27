export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: number;
}

export type EventHandler = (event: DomainEvent) => void;

export interface EventBus {
  subscribe(name: string, handler: EventHandler): void;
  publish(events: readonly DomainEvent[]): void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly queue: DomainEvent[] = [];

  subscribe(name: string, handler: EventHandler): void {
    const existing = this.handlers.get(name) ?? [];
    existing.push(handler);
    this.handlers.set(name, existing);
  }

  publish(events: readonly DomainEvent[]): void {
    this.queue.push(...events);
  }

  drain(): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift() as DomainEvent;
      for (const handler of this.handlers.get(event.name) ?? []) {
        handler(event);
      }
    }
  }
}
