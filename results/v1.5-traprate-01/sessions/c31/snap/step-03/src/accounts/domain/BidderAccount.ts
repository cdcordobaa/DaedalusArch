import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { AccountsError } from './AccountsError';
import { BidderRegistered } from './events/BidderRegistered';

import { AccountSuspended } from './events/AccountSuspended';

export type AccountStatus = 'active' | 'suspended';

export interface AccountRecord {
  readonly id: string;
  readonly name: string;
  readonly creditLimit: number;
  /** Credit the finance desk holds, by reference (telephone and absentee bids). */
  readonly deskHolds: Readonly<Record<string, number>>;
  /** Credit taken by the bid that leads each lot, by lot id. */
  readonly bidHolds: Readonly<Record<string, number>>;
  readonly bidsPlaced: number;
  /** Hammer prices plus buyer's premium for the lots this bidder has bought. */
  readonly amountOwed: number;
  readonly status: AccountStatus;
}

const whole = (n: number): boolean => Number.isInteger(n) && n > 0;

/** A registered bidder's paddle account. The credit held never adds up to more than the credit limit. */
export class BidderAccount {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly creditLimit: number,
    private deskHolds: Record<string, number>,
    private bidHolds: Record<string, number>,
    private bidsPlaced: number,
    private amountOwed: number,
    private status: AccountStatus,
  ) {}

  static register(id: string, name: string, creditLimit: number): [BidderAccount, DomainEvent[]] {
    if (name.trim() === '') throw new AccountsError('a bidder needs a name');
    if (!whole(creditLimit)) throw new AccountsError('the credit limit must be a positive whole amount');
    return [new BidderAccount(id, name, creditLimit, {}, {}, 0, 0, 'active'), [new BidderRegistered(id, name, creditLimit)]];
  }

  static fromRecord(r: AccountRecord): BidderAccount {
    return new BidderAccount(r.id, r.name, r.creditLimit, { ...r.deskHolds }, { ...r.bidHolds }, r.bidsPlaced, r.amountOwed, r.status);
  }

  creditAvailable(): number {
    const sum = (holds: Record<string, number>): number => Object.values(holds).reduce((total, n) => total + n, 0);
    return this.creditLimit - sum(this.deskHolds) - sum(this.bidHolds);
  }

  /** The bid leading a lot takes its amount from the credit available. */
  holdForBid(lotId: string, amount: number): void {
    this.bidHolds = { ...this.bidHolds, [lotId]: amount };
  }

  /** The bidder no longer leads the lot, so the amount comes back. */
  releaseBid(lotId: string): void {
    const { [lotId]: _gone, ...rest } = this.bidHolds;
    this.bidHolds = rest;
  }

  /** The lot was bought: the hammer price stays held, and the price plus a 20% buyer's premium is owed. */
  recordPurchase(hammer: number): void {
    this.amountOwed += Math.round((hammer * 6) / 5);
  }

  /** The finance desk sets credit aside under a reference. */
  holdCredit(ref: string, amount: number): void {
    if (!whole(amount)) throw new AccountsError('the amount must be a positive whole amount');
    if (this.deskHolds[ref] !== undefined) throw new AccountsError(`credit is already held for ${ref}`);
    const available = this.creditAvailable();
    if (amount > available) throw new AccountsError(`not enough credit: ${String(available)} available`);
    this.deskHolds = { ...this.deskHolds, [ref]: amount };
  }

  releaseCredit(ref: string): void {
    if (this.deskHolds[ref] === undefined) throw new AccountsError(`no credit is held for ${ref}`);
    const { [ref]: _gone, ...rest } = this.deskHolds;
    this.deskHolds = rest;
  }

  /** Suspending a suspended bidder changes nothing and gives no events. */
  suspend(): DomainEvent[] {
    if (this.status === 'suspended') return [];
    this.status = 'suspended';
    return [new AccountSuspended(this.id)];
  }

  /** Counts a bid the saleroom took from this paddle. */
  countBid(): void {
    this.bidsPlaced += 1;
  }

  toRecord(): AccountRecord {
    return { id: this.id, name: this.name, creditLimit: this.creditLimit, deskHolds: { ...this.deskHolds }, bidHolds: { ...this.bidHolds }, bidsPlaced: this.bidsPlaced, amountOwed: this.amountOwed, status: this.status };
  }
}
