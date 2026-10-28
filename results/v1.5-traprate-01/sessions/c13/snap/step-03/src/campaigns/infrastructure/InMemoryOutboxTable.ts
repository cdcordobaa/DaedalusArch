import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { PendingEvent, PendingEvents } from '../application/ports/PendingEvents';

interface Row {
  readonly id: number;
  readonly event: DomainEvent;
  readonly handledBy: Set<string>;
}

/** The table that holds stored facts until every reaction to them has run. */
export class InMemoryOutboxTable implements PendingEvents {
  private rows: Row[] = [];
  private nextId = 1;

  append(events: readonly DomainEvent[]): void {
    const added = events.map((event) => ({ id: this.nextId++, event, handledBy: new Set<string>() }));
    this.rows = [...this.rows, ...added];
  }

  pending(): PendingEvent[] {
    return this.rows.map((r) => ({ id: r.id, event: r.event }));
  }

  isHandled(id: number, subscriber: string): boolean {
    return this.rows.find((r) => r.id === id)?.handledBy.has(subscriber) ?? true;
  }

  markHandled(id: number, subscriber: string): void {
    this.rows.find((r) => r.id === id)?.handledBy.add(subscriber);
  }

  complete(id: number): void {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}
