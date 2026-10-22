import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export interface EventStore {
  append(stream: string, events: readonly DomainEvent[], expectedVersion: number): Promise<void>;
  read(stream: string): Promise<DomainEvent[]>;
}
