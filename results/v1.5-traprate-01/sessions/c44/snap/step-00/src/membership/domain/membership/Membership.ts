import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { MembershipError } from '../MembershipError';
import { MemberJoined } from './events';
import { Boat } from './value-objects/Boat';

export type MemberStatus = 'member';
export type ContractStatus = 'none' | 'requested';

export interface MembershipRecord {
  readonly id: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
  readonly status: MemberStatus;
  readonly contract: ContractStatus;
  readonly pontoonId: string | null;
  readonly feesDue: number;
}

/** A boat owner's membership of the marina, with at most one seasonal berth contract and the fees owed. */
export class Membership {
  private recorded: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly owner: string,
    readonly boat: Boat,
    private status: MemberStatus,
    private contract: ContractStatus,
    private pontoonId: string | null,
    private feesDue: number,
  ) {}

  static join(id: string, owner: string, boat: Boat): Membership {
    if (owner.trim() === '') throw new MembershipError('a member needs a name');
    const m = new Membership(id, owner, boat, 'member', 'none', null, 0);
    m.recorded.push(new MemberJoined(id, owner, boat.name, boat.lengthM));
    return m;
  }

  static fromRecord(r: MembershipRecord): Membership {
    return new Membership(r.id, r.owner, Boat.of(r.boatName, r.boatLengthM), r.status, r.contract, r.pontoonId, r.feesDue);
  }

  toRecord(): MembershipRecord {
    return {
      id: this.id, owner: this.owner, boatName: this.boat.name, boatLengthM: this.boat.lengthM,
      status: this.status, contract: this.contract, pontoonId: this.pontoonId, feesDue: this.feesDue,
    };
  }

  /** Asks for a seasonal berth on a pontoon; one contract per member. */
  requestContract(pontoonId: string): void {
    if (this.contract !== 'none') throw new MembershipError(`${this.id} already has a contract`);
    this.contract = 'requested';
    this.pontoonId = pontoonId;
  }

  /** The treasurer's correction, up or down, in whole amounts. */
  adjustFees(delta: number): void {
    if (!Number.isInteger(delta) || delta === 0) throw new MembershipError('an adjustment is a non-zero whole amount');
    this.feesDue += delta;
  }

  pay(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) throw new MembershipError('a payment is a positive whole amount');
    if (amount > this.feesDue) throw new MembershipError(`payment exceeds fees due: ${String(this.feesDue)}`);
    this.feesDue -= amount;
  }

  drainRecorded(): DomainEvent[] {
    const out = this.recorded;
    this.recorded = [];
    return out;
  }
}
