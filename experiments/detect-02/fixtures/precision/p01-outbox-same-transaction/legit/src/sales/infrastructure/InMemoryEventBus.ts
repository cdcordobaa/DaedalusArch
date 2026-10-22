import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { EventBus } from '../application/ports/EventBus';

export class InMemoryEventBus implements EventBus {
  readonly published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }
}
