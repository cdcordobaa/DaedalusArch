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
    private feesDue: number,
    private berth: number | null = null,
    private seasonFee = 0,
  ) {}

  static join(id: string, owner: string, boat: Boat): Membership {
    if (owner.trim() === '') throw new MembershipError('a member needs a name');
    const m = new Membership(id, owner, boat, 'member', 'none', null, 0);
    m.recorded.push(new MemberJoined(id, owner, boat.name, boat.lengthM));
    return m;
  }

  static fromRecord(r: MembershipRecord): Membership {
    return new Membership(r.id, r.owner, Boat.of(r.boatName, r.boatLengthM), r.status, r.contract, r.pontoonId, r.feesDue, r.berth, r.seasonFee);
  }

  toRecord(): MembershipRecord {
    return {
      id: this.id, owner: this.owner, boatName: this.boat.name, boatLengthM: this.boat.lengthM,
      status: this.status, contract: this.contract, pontoonId: this.pontoonId, feesDue: this.feesDue, berth: this.berth, seasonFee: this.seasonFee,
    };
  }

  /** Asks for a seasonal berth on a pontoon; one contract per member. */
  requestContract(pontoonId: string): void {
    if (this.contract !== 'none') throw new MembershipError(`${this.id} already has a contract`);
    this.contract = 'requested';
    this.pontoonId = pontoonId;
  }

  activate(berth: number, berthLengthM: number): void {
    this.contract = 'active';
    this.berth = berth;
    this.seasonFee = Math.round(150 * berthLengthM);
    this.feesDue += this.seasonFee;
  }

  waitlist(): void {
    this.contract = 'waitlisted';
  }

  stormClose(pontoonId: string): void {
    if (this.contract !== 'active' || this.pontoonId !== pontoonId) return;
    this.contract = 'storm-closed';
    this.feesDue -= Math.round(this.seasonFee / 10);
  }

  get heldBerthOn(): string | null {
    return this.status === 'member' && this.berth !== null ? this.pontoonId : null;
  }

  get canLeave(): boolean {
    return this.feesDue <= 0;
  }

  resign(): void {
    this.status = 'resigned';
    this.berth = null;
  }

  get hasResigned(): boolean {
    return this.status === 'resigned';
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
