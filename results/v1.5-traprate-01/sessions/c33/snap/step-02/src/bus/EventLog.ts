import type { DomainEvent } from '../shared-kernel/DomainEvent';

/**
 * Append-only log of what happened. A store appends the events of a record in the same step as it writes the record;
 * a cursor marks how far the log has been passed on.
 */
export class EventLog {
  private readonly entries: DomainEvent[] = [];
  private cursor = 0;

  append(events: readonly DomainEvent[]): void {
    this.entries.push(...events);
  }

  /** The entries after the cursor; moves the cursor to the end. */
  unread(): DomainEvent[] {
    const out = this.entries.slice(this.cursor);
    this.cursor = this.entries.length;
    return out;
  }
}
