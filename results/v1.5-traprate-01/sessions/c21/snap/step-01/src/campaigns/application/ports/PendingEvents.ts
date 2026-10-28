import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

/** Facts stored with the campaign that raised them, waiting to be handed to whoever reacts to them. */
export interface PendingEvents {
  drain(): DomainEvent[];
}
