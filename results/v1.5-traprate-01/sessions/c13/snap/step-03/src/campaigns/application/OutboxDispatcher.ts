import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { PendingEvents } from './ports/PendingEvents';

export type Subscriber = (event: DomainEvent) => void;

/**
 * Hands stored facts to their subscribers, after the change that raised them has been saved. A fact is removed only
 * once every subscriber has handled it; one that fails is kept and retried on the next delivery.
 */
export class OutboxDispatcher {
  private readonly subscribers: { key: string; type: string; run: Subscriber }[] = [];

  constructor(private readonly pending: PendingEvents) {}

  subscribe(type: string, run: Subscriber): void {
    this.subscribers.push({ key: `${type}#${String(this.subscribers.length)}`, type, run });
  }

  deliverPending(): void {
    for (let progressed = true; progressed; ) {
      progressed = false;
      for (const { id, event } of this.pending.pending()) {
        let allHandled = true;
        for (const s of this.subscribers) {
          if (s.type !== event.type || this.pending.isHandled(id, s.key)) continue;
          try {
            s.run(event);
            this.pending.markHandled(id, s.key);
            progressed = true;
          } catch {
            allHandled = false;
          }
        }
        if (allHandled) {
          this.pending.complete(id);
          progressed = true;
        }
      }
    }
  }
}
