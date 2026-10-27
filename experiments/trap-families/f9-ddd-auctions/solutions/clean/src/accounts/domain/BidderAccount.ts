import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { AccountsError } from './AccountsError';
import { AccountSuspended } from './events/AccountSuspended';
import { BidderRegistered } from './events/BidderRegistered';

export type AccountStatus = 'active' | 'suspended';

export interface AccountRecord {
  readonly id: string;
  readonly name: string;
  readonly creditLimit: number;
  /** Credit the finance desk holds, by reference (telephone and absentee bids). */
  readonly deskHolds: Readonly<Record<string, number>>;
  /** Credit taken by the bidder's leading bids, by lot. */
  readonly leadingBids: Readonly<Record<string, number>>;
  /** Hammer prices of the lots bought, by lot. */
  readonly purchases: Readonly<Record<string, number>>;
  readonly bidsPlaced: number;
  readonly status: AccountStatus;
}

/** The house's buyer's premium: 20% on the hammer price, to the nearest whole amount. */
const PREMIUM_PERCENT = 20;

const whole = (n: number): boolean => Number.isInteger(n) && n > 0;
const total = (r: Readonly<Record<string, number>>): number => Object.values(r).reduce((sum, n) => sum + n, 0);
const without = (r: Readonly<Record<string, number>>, key: string): Record<string, number> => {
  const { [key]: _gone, ...rest } = r;
  return rest;
};

/**
 * A registered bidder's paddle account. The credit held by the desk, taken by leading bids and spent on lots bought
 * never adds up to more than the credit limit.
 */
export class BidderAccount {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly creditLimit: number,
    private deskHolds: Record<string, number>,
    private leadingBids: Record<string, number>,
    private purchases: Record<string, number>,
    private bidsPlaced: number,
    private status: AccountStatus,
  ) {}

  static register(id: string, name: string, creditLimit: number): [BidderAccount, DomainEvent[]] {
    if (name.trim() === '') throw new AccountsError('a bidder needs a name');
    if (!whole(creditLimit)) throw new AccountsError('the credit limit must be a positive whole amount');
    return [new BidderAccount(id, name, creditLimit, {}, {}, {}, 0, 'active'), [new BidderRegistered(id, name, creditLimit)]];
  }

  static fromRecord(r: AccountRecord): BidderAccount {
    return new BidderAccount(r.id, r.name, r.creditLimit, { ...r.deskHolds }, { ...r.leadingBids }, { ...r.purchases }, r.bidsPlaced, r.status);
  }

  creditAvailable(): number {
    return this.creditLimit - total(this.deskHolds) - total(this.leadingBids) - total(this.purchases);
  }

  amountOwed(): number {
    return Object.values(this.purchases).reduce((sum, hammer) => sum + hammer + Math.round((hammer * PREMIUM_PERCENT) / 100), 0);
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
    this.deskHolds = without(this.deskHolds, ref);
  }

  /** A bid of this paddle now leads a lot: it is counted and its amount is taken from the credit. */
  takeLeadingBid(lotId: string, amount: number): void {
    this.bidsPlaced += 1;
    const available = this.creditAvailable() + (this.leadingBids[lotId] ?? 0);
    if (amount > available) throw new AccountsError(`not enough credit: ${String(available)} available`);
    this.leadingBids = { ...this.leadingBids, [lotId]: amount };
  }

  /** The bid on this lot no longer leads (outbid, or the lot went unsold): its credit comes back. */
  freeLeadingBid(lotId: string): void {
    if (this.leadingBids[lotId] === undefined) return;
    this.leadingBids = without(this.leadingBids, lotId);
  }

  /** The hammer fell on this paddle's bid: the amount stays spent and is owed with the premium. */
  buy(lotId: string, hammerPrice: number): void {
    if (this.purchases[lotId] !== undefined) return;
    this.leadingBids = without(this.leadingBids, lotId);
    this.purchases = { ...this.purchases, [lotId]: hammerPrice };
  }

  /** No more bidding: the credit of the leading bids comes back. Desk holds and purchases stay. */
  suspend(): DomainEvent[] {
    if (this.status === 'suspended') return [];
    this.status = 'suspended';
    this.leadingBids = {};
    return [new AccountSuspended(this.id)];
  }

  toRecord(): AccountRecord {
    return {
      id: this.id, name: this.name, creditLimit: this.creditLimit, deskHolds: { ...this.deskHolds }, leadingBids: { ...this.leadingBids },
      purchases: { ...this.purchases }, bidsPlaced: this.bidsPlaced, status: this.status,
    };
  }
}
