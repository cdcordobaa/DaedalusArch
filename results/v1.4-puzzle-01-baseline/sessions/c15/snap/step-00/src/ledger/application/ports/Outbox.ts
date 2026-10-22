import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

/** Events stored together with the change that raised them, waiting to be delivered. */
export interface Outbox {
  takePending(): DomainEvent[];
}
