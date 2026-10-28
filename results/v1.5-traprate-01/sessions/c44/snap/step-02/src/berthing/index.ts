import type { DomainEvent } from '../shared-kernel/DomainEvent';
import { membershipListeners } from './acl/MembershipFeed';
import { BerthQueries } from './application/BerthQueries';
import { GateKeeping } from './application/GateKeeping';
import { HarbourMaster } from './application/HarbourMaster';
import type { GateRegister } from './application/ports/GateRegister';
import type { BerthGiven, PontoonView } from './contracts/PontoonView';
import type { PontoonRepository } from './domain/pontoon/PontoonRepository';

export type { PontoonClosedMessage } from './contracts/messages';
export type { BerthGiven, PontoonView } from './contracts/PontoonView';

/** What the rest of the system may call. */
export interface BerthingModule {
  addPontoon(name: string, berthLengthsM: readonly number[]): string;
  pontoon(pontoonId: string): PontoonView | undefined;
  /** The harbour master's berth for a visiting boat; throws when no free berth fits. */
  assignBerth(pontoonId: string, occupant: string, boatLengthM: number): BerthGiven;
  /** A seasonal berth; undefined, with nothing taken, when no free berth fits. */
  reserveBerth(pontoonId: string, occupant: string, boatLengthM: number): BerthGiven | undefined;
  vacateBerth(pontoonId: string, occupant: string): void;
  /** Closes the pontoon for a storm; closing a closed pontoon changes nothing. */
  closePontoon(pontoonId: string): void;
  gateList(): string[];
  /** Listeners berthing wants subscribed, by message type. */
  readonly listensTo: Readonly<Record<string, (message: DomainEvent) => void>>;
}

export function createBerthing(pontoons: PontoonRepository, gate: GateRegister): BerthingModule {
  const master = new HarbourMaster(pontoons);
  const queries = new BerthQueries(pontoons, gate);
  return {
    addPontoon: (name, lengths) => master.addPontoon(name, lengths),
    pontoon: (id) => queries.pontoon(id),
    assignBerth: (pontoonId, occupant, lengthM) => master.assignBerth(pontoonId, occupant, lengthM),
    reserveBerth: (pontoonId, occupant, lengthM) => master.reserveBerth(pontoonId, occupant, lengthM),
    vacateBerth: (pontoonId, occupant) => master.vacateBerth(pontoonId, occupant),
    closePontoon: (pontoonId) => master.closePontoon(pontoonId),
    gateList: () => queries.gateList(),
    listensTo: membershipListeners(new GateKeeping(gate)),
  };
}
