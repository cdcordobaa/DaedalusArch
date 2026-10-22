import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { TransferSent } from './events/TransferSent';
import type { AccountId } from './value-objects/AccountId';

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Ids of the transfers already credited to this account. */
  readonly received?: readonly string[];
  /** The day (YYYY-MM-DD) of the last transfer sent, and the cents sent on that day. */
  readonly sentDay?: string;
  readonly sentCents?: number;
}

/** The most an account may send by transfer per calendar day, in cents. */
export const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private received: ReadonlySet<string> = new Set(),
    private sentDay: string = '',
    private sentCents: number = 0,
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, new Set(state.received ?? []), state.sentDay ?? '', state.sentCents ?? 0);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
  }

  withdraw(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
  }

  /** Takes the money out and records that it is on its way to another account. */
  sendTransfer(transferId: string, to: AccountId, amount: Money, today: string): void {
    if (amount.currency !== this.currency) throw new LedgerError(`currency mismatch: ${this.currency} vs ${amount.currency}`);
    const sentSoFar = this.sentDay === today ? this.sentCents : 0;
    const left = Math.max(0, DAILY_TRANSFER_LIMIT_CENTS - sentSoFar);
    if (amount.isPositive() && amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, this.currency).format()} left today`);
    }
    this.withdraw(amount);
    this.sentDay = today;
    this.sentCents = sentSoFar + amount.cents;
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.cents, amount.currency));
  }

  /** Credits a transfer once; a repeated delivery of the same transfer changes nothing. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.received.has(transferId)) return;
    this.deposit(amount);
    this.received = new Set([...this.received, transferId]);
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, received: [...this.received], sentDay: this.sentDay, sentCents: this.sentCents };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
