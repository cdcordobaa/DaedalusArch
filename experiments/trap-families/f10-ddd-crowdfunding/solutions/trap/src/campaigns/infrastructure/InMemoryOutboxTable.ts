import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { PendingEvents } from '../application/ports/PendingEvents';

/** The table that holds stored facts until they are handed on. */
export class InMemoryOutboxTable implements PendingEvents {
  private rows: DomainEvent[] = [];

  append(events: readonly DomainEvent[]): void {
    this.rows = [...this.rows, ...events];
  }

  drain(): DomainEvent[] {
    const out = this.rows;
    this.rows = [];
    return out;
  }
}
