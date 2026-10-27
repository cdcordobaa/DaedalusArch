import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { MembershipError } from '../MembershipError';
import { ContractRequested, MemberJoined, MemberResigned } from './events';
import { Boat } from './value-objects/Boat';

export type MemberStatus = 'member' | 'resigned';
export type ContractStatus = 'none' | 'requested' | 'active' | 'waitlisted' | 'storm-closed' | 'ended';

/** The season fee per metre of berth length. */
const SEASON_RATE_PER_METRE = 150;
/** The share of the season fee given back when a storm closes the pontoon. */
const STORM_CREDIT_SHARE = 0.1;

export interface MembershipRecord {
  readonly id: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
  readonly status: MemberStatus;
  readonly contract: ContractStatus;
  readonly pontoonId: string | null;
  readonly berth: number | null;
  readonly seasonFee: number;
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
    private berth: number | null,
    private seasonFee: number,
    private feesDue: number,
  ) {}

  static join(id: string, owner: string, boat: Boat): Membership {
    if (owner.trim() === '') throw new MembershipError('a member needs a name');
    const m = new Membership(id, owner, boat, 'member', 'none', null, null, 0, 0);
    m.recorded.push(new MemberJoined(id, owner, boat.name, boat.lengthM));
    return m;
  }

  static fromRecord(r: MembershipRecord): Membership {
    return new Membership(r.id, r.owner, Boat.of(r.boatName, r.boatLengthM), r.status, r.contract, r.pontoonId, r.berth, r.seasonFee, r.feesDue);
  }

  toRecord(): MembershipRecord {
    return {
      id: this.id, owner: this.owner, boatName: this.boat.name, boatLengthM: this.boat.lengthM,
      status: this.status, contract: this.contract, pontoonId: this.pontoonId, berth: this.berth,
      seasonFee: this.seasonFee, feesDue: this.feesDue,
    };
  }

  /** Asks for a seasonal berth on a pontoon; one contract per member. The pontoon answers. */
  requestContract(pontoonId: string): void {
    if (this.status === 'resigned') throw new MembershipError(`${this.id} has resigned`);
    if (this.contract !== 'none') throw new MembershipError(`${this.id} already has a contract`);
    this.contract = 'requested';
    this.pontoonId = pontoonId;
    this.recorded.push(new ContractRequested(this.id, pontoonId, this.boat.lengthM));
  }

  /** The pontoon gave a berth: the contract is active and the season fee is charged. */
  berthGranted(pontoonId: string, berth: number, berthLengthM: number): void {
    if (this.contract !== 'requested' || this.pontoonId !== pontoonId) return;
    this.contract = 'active';
    this.berth = berth;
    this.seasonFee = Math.round(SEASON_RATE_PER_METRE * berthLengthM);
    this.feesDue += this.seasonFee;
  }

  berthRefused(pontoonId: string): void {
    if (this.contract !== 'requested' || this.pontoonId !== pontoonId) return;
    this.contract = 'waitlisted';
  }

  /** A storm closed the pontoon: an active contract on it is suspended and a share of the season fee is credited. */
  pontoonClosed(pontoonId: string): void {
    if (this.contract !== 'active' || this.pontoonId !== pontoonId) return;
    this.contract = 'storm-closed';
    this.feesDue -= Math.round(this.seasonFee * STORM_CREDIT_SHARE);
  }

  /** Leaves the marina. Refused while fees are due; leaving twice changes nothing. */
  resign(): 'resigned' | 'refused' {
    if (this.status === 'resigned') return 'resigned';
    if (this.feesDue > 0) return 'refused';
    const heldOn = this.berth === null ? null : this.pontoonId;
    this.status = 'resigned';
    if (this.contract !== 'none') this.contract = 'ended';
    this.berth = null;
    this.recorded.push(new MemberResigned(this.id, heldOn));
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
