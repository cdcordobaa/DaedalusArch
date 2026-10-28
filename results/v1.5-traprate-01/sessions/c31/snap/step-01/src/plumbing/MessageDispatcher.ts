import type { DomainEvent } from '../shared-kernel/DomainEvent';
import type { Outbox } from './Outbox';

export type Reaction = (event: DomainEvent) => void;

/**
 * Hands the events in the outbox to the reactions subscribed to their type. Reactions may write changes that append
 * new events; draining goes on until the outbox is empty.
 */
export class MessageDispatcher {
  private readonly reactions = new Map<string, Reaction[]>();

  constructor(private readonly outbox: Outbox) {}

  subscribe(type: string, reaction: Reaction): void {
    this.reactions.set(type, [...(this.reactions.get(type) ?? []), reaction]);
  }

  drain(): void {
    for (let batch = this.outbox.takeAll(); batch.length > 0; batch = this.outbox.takeAll()) {
      for (const event of batch) for (const reaction of this.reactions.get(event.type) ?? []) reaction(event);
    }
  }
}
