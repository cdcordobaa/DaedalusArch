import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export interface PendingEvent {
  readonly id: number;
  readonly event: DomainEvent;
}

/**
 * Facts stored with the campaign that raised them. A fact stays until every subscriber has handled it, so a
 * reaction that fails is retried instead of lost.
 */
export interface PendingEvents {
  pending(): PendingEvent[];
  isHandled(id: number, subscriber: string): boolean;
  markHandled(id: number, subscriber: string): void;
  complete(id: number): void;
}
