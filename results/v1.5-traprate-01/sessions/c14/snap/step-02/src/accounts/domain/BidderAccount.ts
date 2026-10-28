import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { AccountsError } from './AccountsError';
import { BidderRegistered } from './events/BidderRegistered';

export type AccountStatus = 'active';

export interface AccountRecord {
  readonly id: string;
  readonly name: string;
  readonly creditLimit: number;
  /** Credit the finance desk holds, by reference (telephone and absentee bids). */
  readonly deskHolds: Readonly<Record<string, number>>;
  /** Credit covering the bid this paddle leads with, by lot. */
  readonly bidHolds: Readonly<Record<string, number>>;
  readonly bidsPlaced: number;
  /** Hammer prices plus buyer's premium for the lots this paddle bought. */
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
    const total = (holds: Record<string, number>): number => Object.values(holds).reduce((sum, n) => sum + n, 0);
    return this.creditLimit - total(this.deskHolds) - total(this.bidHolds);
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

  /** Sets credit aside for the bid this paddle leads a lot with, in place of any earlier bid on that lot. */
  holdForBid(lotId: string, amount: number): void {
    this.bidHolds = { ...this.bidHolds, [lotId]: amount };
  }

  /** Gives back the credit held for a bid on a lot. */
  releaseBid(lotId: string): void {
    const { [lotId]: _gone, ...rest } = this.bidHolds;
    this.bidHolds = rest;
  }

  /** Counts a bid the saleroom took from this paddle. */
  countBid(): void {
    this.bidsPlaced += 1;
  }

  /** The lot was bought: the hammer price stays held, and the price plus the 20% buyer's premium is owed. */
  buy(hammer: number): void {
    this.amountOwed += hammer + Math.round((hammer * 2) / 10);
  }

  toRecord(): AccountRecord {
    return { id: this.id, name: this.name, creditLimit: this.creditLimit, deskHolds: { ...this.deskHolds }, bidHolds: { ...this.bidHolds }, bidsPlaced: this.bidsPlaced, amountOwed: this.amountOwed, status: this.status };
  }
}
