import type { DomainEvent } from '../shared-kernel/DomainEvent';
import type { EventLog } from './EventLog';

export type Listener = (event: DomainEvent) => void;

/**
 * Passes logged events to their listeners once the call that logged them has finished. Listeners may cause new
 * entries; the courier keeps going until nothing in the log is unread.
 */
export class Courier {
  private readonly listeners = new Map<string, Listener[]>();

  constructor(private readonly log: EventLog) {}

  subscribe(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatchOutstanding(): void {
    for (let batch = this.log.unread(); batch.length > 0; batch = this.log.unread()) {
      for (const event of batch) for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    }
  }
}
