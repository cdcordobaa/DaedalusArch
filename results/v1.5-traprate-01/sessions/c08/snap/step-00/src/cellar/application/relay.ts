import type { CellarEvent } from '../domain/events';
import type { Mailbox } from './ports';

export type Reaction = (fact: CellarEvent) => void;

/** Hands every kept fact to the reactions registered for its kind, until the mailbox is empty. */
export function createRelay(mailbox: Mailbox) {
  const reactions = new Map<CellarEvent['kind'], Reaction[]>();
  return {
    when(kind: CellarEvent['kind'], reaction: Reaction): void {
      reactions.set(kind, [...(reactions.get(kind) ?? []), reaction]);
    },
    flush(): void {
      for (let waiting = mailbox.collect(); waiting.length > 0; waiting = mailbox.collect()) {
        for (const fact of waiting) for (const reaction of reactions.get(fact.kind) ?? []) reaction(fact);
      }
    },
  };
}
