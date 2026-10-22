import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Calendar day (YYYY-MM-DD) that `sentCents` refers to. */
  readonly sentDay?: string;
  /** Cents sent by transfer on `sentDay`. */
  readonly sentCents?: number;
}

export const DAILY_TRANSFER_LIMIT_CENTS = 100_000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private sentDay?: string,
    private sentCents: number = 0,
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentCents ?? 0);
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

  /** Withdraws for an outgoing transfer, enforcing the daily transfer limit. */
  send(amount: Money, day: string): void {
    const used = this.sentDay === day ? this.sentCents : 0;
    const left = Math.max(0, DAILY_TRANSFER_LIMIT_CENTS - used);
    if (amount.cents > left) {
      throw new LedgerError(`daily transfer limit reached: ${Money.of(left / 100, this.currency).format()} left today`);
    }
    this.withdraw(amount);
    this.sentDay = day;
    this.sentCents = used + amount.cents;
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sentDay: this.sentDay, sentCents: this.sentCents };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
