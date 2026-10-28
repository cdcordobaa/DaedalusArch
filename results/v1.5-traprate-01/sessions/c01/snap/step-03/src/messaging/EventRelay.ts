import type { DomainEvent } from '../shared-kernel/DomainEvent';
import type { Outbox } from './Outbox';

export type EventHandler = (event: DomainEvent) => void;

/**
 * Delivers stored events to their subscribers after the command that stored them has finished. Handlers may store
 * new events; delivery goes on until every outbox is empty.
 */
export class EventRelay {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(private readonly outboxes: readonly Outbox[]) {}

  on(type: string, handler: EventHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  deliverPending(): void {
    let batch = this.outboxes.flatMap((o) => o.takePending());
    while (batch.length > 0) {
      for (const event of batch) for (const handler of this.handlers.get(event.type) ?? []) handler(event);
      batch = this.outboxes.flatMap((o) => o.takePending());
    }
  }
}
