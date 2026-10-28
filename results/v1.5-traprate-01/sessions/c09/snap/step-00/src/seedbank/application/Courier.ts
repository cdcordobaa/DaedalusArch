import type { LibraryEvent } from '../../shared-kernel/LibraryEvent';
import type { PendingEvents } from './ports/PendingEvents';

export type Listener = (event: LibraryEvent) => void;

/** Passes kept events to their listeners once the request that raised them has been kept. */
export class Courier {
  private readonly listeners: Record<string, Listener[]> = {};

  constructor(private readonly pending: PendingEvents) {}

  subscribe(kind: string, listener: Listener): void {
    (this.listeners[kind] ??= []).push(listener);
  }

  flush(): void {
    for (let batch = this.pending.drain(); batch.length > 0; batch = this.pending.drain()) {
      batch.forEach((event) => (this.listeners[event.kind] ?? []).forEach((listen) => listen(event)));
    }
  }
}
