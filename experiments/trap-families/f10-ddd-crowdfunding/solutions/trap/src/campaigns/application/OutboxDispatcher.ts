import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { PendingEvents } from './ports/PendingEvents';

export type Subscriber = (event: DomainEvent) => void;

/** Hands stored facts to their subscribers, after the change that raised them has been saved. */
export class OutboxDispatcher {
  private readonly subscribers: { type: string; run: Subscriber }[] = [];

  constructor(private readonly pending: PendingEvents) {}

  subscribe(type: string, run: Subscriber): void {
    this.subscribers.push({ type, run });
  }

  deliverPending(): void {
    for (let batch = this.pending.drain(); batch.length > 0; batch = this.pending.drain()) {
      for (const event of batch) {
        for (const s of this.subscribers) if (s.type === event.type) s.run(event);
      }
    }
  }
}
