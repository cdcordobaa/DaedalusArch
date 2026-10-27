import type { BerthGrantedMessage, BerthRefusedMessage, PontoonClosedMessage } from '../../berthing';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { BerthOutcomes } from '../application/BerthOutcomes';

/** Turns what berthing publishes into calls membership understands. */
export function berthingListeners(outcomes: BerthOutcomes): Record<string, (message: DomainEvent) => void> {
  return {
    BerthGranted: (message) => {
      const g = message as BerthGrantedMessage;
      outcomes.granted(g.memberId, g.pontoonId, g.berth, g.lengthM);
    },
    BerthRefused: (message) => {
      const r = message as BerthRefusedMessage;
      outcomes.refused(r.memberId, r.pontoonId);
    },
    PontoonClosed: (message) => {
      const c = message as PontoonClosedMessage;
      outcomes.pontoonClosed(c.pontoonId, c.occupants);
    },
  };
}
