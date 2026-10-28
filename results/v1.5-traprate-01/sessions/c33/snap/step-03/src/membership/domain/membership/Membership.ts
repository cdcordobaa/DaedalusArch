import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { MembershipError } from '../MembershipError';
import { MemberJoined } from './events';
import { Boat } from './value-objects/Boat';

export type MemberStatus = 'member' | 'resigned';
export type ContractStatus = 'none' | 'requested' | 'active' | 'waitlisted' | 'storm-closed';

export interface MembershipRecord {
  readonly id: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
  readonly status: MemberStatus;
  readonly contract: ContractStatus;
  readonly pontoonId: string | null;
  readonly berth: number | null;
  readonly feesDue: number;
  readonly seasonFee?: number;
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
    private berth: number | null,
    private feesDue: number,
    private seasonFee = 0,
  ) {}

  static join(id: string, owner: string, boat: Boat): Membership {
    if (owner.trim() === '') throw new MembershipError('a member needs a name');
    const m = new Membership(id, owner, boat, 'member', 'none', null, null, 0);
    m.recorded.push(new MemberJoined(id, owner, boat.name, boat.lengthM));
    return m;
  }

  static fromRecord(r: MembershipRecord): Membership {
    return new Membership(r.id, r.owner, Boat.of(r.boatName, r.boatLengthM), r.status, r.contract, r.pontoonId, r.berth, r.feesDue, r.seasonFee ?? 0);
  }

  toRecord(): MembershipRecord {
    return {
      id: this.id, owner: this.owner, boatName: this.boat.name, boatLengthM: this.boat.lengthM,
      status: this.status, contract: this.contract, pontoonId: this.pontoonId, berth: this.berth, feesDue: this.feesDue, seasonFee: this.seasonFee,
    };
  }

  /** Asks for a seasonal berth on a pontoon; one contract per member. */
  assertCanContract(): void {
    if (this.status === 'resigned') throw new MembershipError(`${this.id} has resigned`);
    if (this.contract !== 'none') throw new MembershipError(`${this.id} already has a contract`);
  }

  /** The contract is active on the given berth; the season fee is 150 per metre of the berth, rounded. */
  activateContract(pontoonId: string, berth: number, berthLengthM: number): void {
    this.assertCanContract();
    this.contract = 'active';
    this.pontoonId = pontoonId;
    this.berth = berth;
    this.seasonFee = Math.round(150 * berthLengthM);
    this.feesDue += this.seasonFee;
  }

  /** A storm closes the pontoon: an active contract ends, with a tenth of the season fee off. */
  stormClose(pontoonId: string): void {
    if (this.contract !== 'active' || this.pontoonId !== pontoonId) return;
    this.contract = 'storm-closed';
    this.feesDue -= Math.round(this.seasonFee / 10);
  }

  /** No berth fits: the member waits, nothing is taken or charged. */
  waitlist(pontoonId: string): void {
    this.assertCanContract();
    this.contract = 'waitlisted';
    this.pontoonId = pontoonId;
    this.berth = null;
  }

  /** Leaves the marina unless fees are due; the berth is dropped here and must be freed on its pontoon by the caller. */
  resign(): 'resigned' | 'refused' {
    if (this.status === 'resigned') return 'resigned';
    if (this.feesDue > 0) return 'refused';
    this.status = 'resigned';
    this.pontoonId = null;
    this.berth = null;
    return 'resigned';
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
