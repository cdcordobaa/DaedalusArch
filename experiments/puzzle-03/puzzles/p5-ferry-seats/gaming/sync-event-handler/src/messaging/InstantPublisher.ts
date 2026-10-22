import type { DomainEvent } from '../shared-kernel/DomainEvent';

export type InstantHandler = (event: DomainEvent) => void;

/** Hands an event to its subscribers at once. */
export class InstantPublisher {
  private readonly handlers = new Map<string, InstantHandler[]>();

  on(type: string, handler: InstantHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  publish(event: DomainEvent): void {
    for (const handler of this.handlers.get(event.type) ?? []) handler(event);
  }
}
