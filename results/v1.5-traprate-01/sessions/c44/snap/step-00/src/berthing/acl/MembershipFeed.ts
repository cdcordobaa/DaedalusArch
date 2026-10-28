import type { MemberJoinedMessage } from '../../membership';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { GateKeeping } from '../application/GateKeeping';

/** Turns what membership publishes into calls berthing understands. */
export function membershipListeners(gate: GateKeeping): Record<string, (message: DomainEvent) => void> {
  return {
    MemberJoined: (message) => {
      const joined = message as MemberJoinedMessage;
      gate.admit(joined.boatName, joined.owner);
    },
  };
}
