import type { PontoonClosedMessage } from '../berthing';
import type { DomainEvent } from '../shared-kernel/DomainEvent';
import { ContractDesk } from './application/ContractDesk';
import { MemberOffice } from './application/MemberOffice';
import { MemberQueries } from './application/MemberQueries';
import type { PontoonLookup } from './application/ports/PontoonLookup';
import type { MembershipView } from './contracts/MembershipView';
import type { MembershipRepository } from './domain/membership/MembershipRepository';

export type { MembershipView } from './contracts/MembershipView';
export type { MemberJoinedMessage } from './contracts/messages';

/** What the rest of the system may call. */
export interface MembershipModule {
  join(owner: string, boatName: string, boatLengthM: number): string;
  member(memberId: string): MembershipView | undefined;
  payFees(memberId: string, amount: number): void;
  /** The treasurer's correction of a member's fees, up or down. */
  adjustFees(memberId: string, delta: number): void;
  signContract(memberId: string, pontoonId: string): void;
  /** 'refused', with nothing changed, while fees are due; resigning twice changes nothing. */
  resign(memberId: string): 'resigned' | 'refused';
  /** Listeners membership wants subscribed, by message type. */
  readonly listensTo: Readonly<Record<string, (message: DomainEvent) => void>>;
}

export function createMembership(members: MembershipRepository, pontoons: PontoonLookup): MembershipModule {
  const office = new MemberOffice(members);
  const desk = new ContractDesk(members, pontoons);
  const queries = new MemberQueries(members);
  return {
    join: (owner, boatName, lengthM) => office.join(owner, boatName, lengthM),
    member: (id) => queries.member(id),
    payFees: (id, amount) => office.payFees(id, amount),
    adjustFees: (id, delta) => office.adjustFees(id, delta),
    signContract: (memberId, pontoonId) => desk.signContract(memberId, pontoonId),
    resign: (memberId) => desk.resign(memberId),
    listensTo: {
      PontoonClosed: (message) => desk.stormClosed((message as PontoonClosedMessage).pontoonId),
    },
  };
}
