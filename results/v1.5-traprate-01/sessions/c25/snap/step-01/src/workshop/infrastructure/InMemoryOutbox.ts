import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { Outbox } from '../application/ports/Outbox';

/** The shop's event table: every store appends a change's pending events in the same step as the change. */
export class InMemoryOutbox implements Outbox {
  private rows: DomainEvent[] = [];

  append(events: DomainEvent[]): void {
    this.rows = [...this.rows, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.rows;
    this.rows = [];
    return out;
  }
}
