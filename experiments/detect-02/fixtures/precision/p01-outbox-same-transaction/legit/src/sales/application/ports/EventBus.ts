import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}
