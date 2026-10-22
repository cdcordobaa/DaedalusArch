import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';

/** Driven port: events are appended with the aggregate's save and relayed to other contexts later. */
export interface Outbox {
  append(events: readonly DomainEvent[]): Promise<void>;
}
