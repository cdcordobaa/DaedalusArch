import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

/** Events stored in the same transaction as the change that raised them. */
export interface Outbox {
  add(events: readonly DomainEvent[]): Promise<void>;
  takePending(limit: number): Promise<DomainEvent[]>;
}
