import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { EventStore } from '../application/ports/EventStore';

export class InMemoryEventStore implements EventStore {
  private readonly streams = new Map<string, DomainEvent[]>();

  async append(stream: string, events: readonly DomainEvent[], expectedVersion: number): Promise<void> {
    const current = this.streams.get(stream) ?? [];
    if (current.length !== expectedVersion) throw new Error(`concurrency conflict on ${stream}`);
    this.streams.set(stream, [...current, ...events]);
  }

  async read(stream: string): Promise<DomainEvent[]> {
    return [...(this.streams.get(stream) ?? [])];
  }
}
