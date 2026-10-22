import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export interface EventPublisher {
  publish(event: DomainEvent): void;
}
