import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from './ports/Outbox';

export type EventHandler = (event: DomainEvent) => void;

/** Delivers stored events to their handlers after the change that raised them is saved. */
export class EventRelay {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(private readonly outbox: Outbox) {}

  on(type: string, handler: EventHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  deliverPending(): void {
    let batch = this.outbox.takePending();
    while (batch.length > 0) {
      for (const event of batch) for (const handler of this.handlers.get(event.type) ?? []) handler(event);
      batch = this.outbox.takePending();
    }
  }
}
