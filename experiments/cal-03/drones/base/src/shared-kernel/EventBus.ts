import type { DomainEvent } from './DomainEvent';

export class EventBus {
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => void>>();

  subscribe<E extends DomainEvent>(name: string, handler: (event: E) => void): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as (event: DomainEvent) => void);
    this.handlers.set(name, list);
  }

  publish(event: DomainEvent): void {
    for (const handler of this.handlers.get(event.name) ?? []) {
      handler(event);
    }
  }
}
