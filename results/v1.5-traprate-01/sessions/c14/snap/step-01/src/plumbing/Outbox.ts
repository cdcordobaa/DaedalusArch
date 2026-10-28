import type { DomainEvent } from '../shared-kernel/DomainEvent';

/** One outbox for the whole house. A store appends the events of a change in the same step as it writes the change. */
export class Outbox {
  private waiting: DomainEvent[] = [];

  append(events: readonly DomainEvent[]): void {
    this.waiting.push(...events);
  }

  takeAll(): DomainEvent[] {
    const out = this.waiting;
    this.waiting = [];
    return out;
  }
}
