import type { DomainEvent } from '../shared-kernel/DomainEvent';
import { membershipListeners } from './acl/MembershipFeed';
import { BerthQueries } from './application/BerthQueries';
import { ContractBerths } from './application/ContractBerths';
import { GateKeeping } from './application/GateKeeping';
import { HarbourMaster } from './application/HarbourMaster';
import type { GateRegister } from './application/ports/GateRegister';
import { StormWatch } from './application/StormWatch';
import type { BerthGiven, PontoonView } from './contracts/PontoonView';
import type { PontoonRepository } from './domain/pontoon/PontoonRepository';

export type { BerthGiven, PontoonView } from './contracts/PontoonView';
export type { BerthGrantedMessage, BerthRefusedMessage, PontoonClosedMessage } from './contracts/messages';

/** What the rest of the system may call. */
export interface BerthingModule {
  addPontoon(name: string, berthLengthsM: readonly number[]): string;
  pontoon(pontoonId: string): PontoonView | undefined;
  /** The harbour master's berth for a visiting boat; throws when no free berth fits. */
  assignBerth(pontoonId: string, occupant: string, boatLengthM: number): BerthGiven;
  vacateBerth(pontoonId: string, occupant: string): void;
  gateList(): string[];
  /** Closes a pontoon for a storm. */
  closePontoon(pontoonId: string): void;
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
    vacateBerth: (pontoonId, occupant) => master.vacateBerth(pontoonId, occupant),
    gateList: () => queries.gateList(),
    closePontoon: (id) => new StormWatch(pontoons).closePontoon(id),
    listensTo: membershipListeners(new GateKeeping(gate), new ContractBerths(pontoons)),
  };
}
