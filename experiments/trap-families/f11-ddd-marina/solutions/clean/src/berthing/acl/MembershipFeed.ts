import type { ContractRequestedMessage, MemberJoinedMessage, MemberResignedMessage } from '../../membership';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { ContractBerths } from '../application/ContractBerths';
import type { GateKeeping } from '../application/GateKeeping';

/** Turns what membership publishes into calls berthing understands. */
export function membershipListeners(gate: GateKeeping, berths: ContractBerths): Record<string, (message: DomainEvent) => void> {
  return {
    MemberJoined: (message) => {
      const joined = message as MemberJoinedMessage;
      gate.admit(joined.boatName, joined.owner);
    },
    ContractRequested: (message) => {
      const requested = message as ContractRequestedMessage;
      berths.contractRequested(requested.pontoonId, requested.memberId, requested.boatLengthM);
    },
    MemberResigned: (message) => {
      const resigned = message as MemberResignedMessage;
      if (resigned.pontoonId !== null) berths.memberLeft(resigned.pontoonId, resigned.memberId);
    },
  };
}
