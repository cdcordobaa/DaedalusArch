import type { CellarEvent } from '../domain/events';
import type { Mailbox } from '../application/ports';

export function memoryMailbox(): Mailbox {
  let waiting: CellarEvent[] = [];
  return {
    post: (facts) => { waiting = [...waiting, ...facts]; },
    collect: () => {
      const out = waiting;
      waiting = [];
      return out;
    },
  };
}
