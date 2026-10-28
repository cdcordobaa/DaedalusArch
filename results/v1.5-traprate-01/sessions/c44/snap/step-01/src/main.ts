import { createBerthing } from './berthing';
import { InMemoryGateRegister } from './berthing/infrastructure/InMemoryGateRegister';
import { InMemoryPontoonStore } from './berthing/infrastructure/InMemoryPontoonStore';
import { Courier } from './bus/Courier';
import { EventLog } from './bus/EventLog';
import { createMembership } from './membership';
import { BerthingLookup } from './membership/acl/BerthingLookup';
import { InMemoryMembershipStore } from './membership/infrastructure/InMemoryMembershipStore';

/** Composition root. After every command the courier passes on what it logged, before the command returns. */
export function createApp() {
  const log = new EventLog();
  const courier = new Courier(log);
  const berthing = createBerthing(new InMemoryPontoonStore(log), new InMemoryGateRegister());
  const membership = createMembership(new InMemoryMembershipStore(log), new BerthingLookup(berthing));
  for (const listeners of [berthing.listensTo, membership.listensTo]) {
    for (const [type, listener] of Object.entries(listeners)) courier.subscribe(type, listener);
  }
  const settled = <T>(result: T): T => {
    courier.dispatchOutstanding();
    return result;
  };
  return {
    addPontoon: (name: string, berthLengthsM: number[]): string => settled(berthing.addPontoon(name, berthLengthsM)),
    pontoon: (pontoonId: string) => berthing.pontoon(pontoonId),
    moorVisitor: (pontoonId: string, boatName: string, boatLengthM: number): number => settled(berthing.assignBerth(pontoonId, boatName, boatLengthM).berth),
    visitorLeaves: (pontoonId: string, boatName: string): void => settled(berthing.vacateBerth(pontoonId, boatName)),
    gateList: (): string[] => berthing.gateList(),
    join: (owner: string, boatName: string, boatLengthM: number): string => settled(membership.join(owner, boatName, boatLengthM)),
    member: (memberId: string) => membership.member(memberId),
    payFees: (memberId: string, amount: number): void => settled(membership.payFees(memberId, amount)),
    adjustFees: (memberId: string, delta: number): void => settled(membership.adjustFees(memberId, delta)),
    signContract: (memberId: string, pontoonId: string): void => settled(membership.signContract(memberId, pontoonId)),
  };
}
