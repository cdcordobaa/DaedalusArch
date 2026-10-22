import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { MoneyTransferred } from './events/MoneyTransferred';
import type { AccountId } from './value-objects/AccountId';

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  /** Transfers sent from this account so far. */
  readonly sent?: number;
  /** Ids of the transfers already credited to this account. */
  readonly received?: readonly string[];
  /** Calendar day (YYYY-MM-DD) of the latest transfer sent, and the cents sent on that day. */
  readonly sentDay?: string;
  readonly sentOnDay?: number;
}

export const DAILY_TRANSFER_LIMIT_CENTS = 100000;

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private sent: number = 0,
    private received: readonly string[] = [],
    private sentDay: string = '',
    private sentOnDay: number = 0,
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sent ?? 0, state.received ?? [], state.sentDay ?? '', state.sentOnDay ?? 0);
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

  /** Takes the money out and records that it is on its way to the other account. */
  sendTransfer(to: AccountId, amount: Money, day: string): void {
    const used = this.sentDay === day ? this.sentOnDay : 0;
    if (amount.isPositive() && used + amount.cents > DAILY_TRANSFER_LIMIT_CENTS) {
      const left = Money.of((DAILY_TRANSFER_LIMIT_CENTS - used) / 100, this.currency);
      throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    }
    this.withdraw(amount);
    this.sentDay = day;
    this.sentOnDay = used + amount.cents;
    this.sent += 1;
    this.pending.push(new MoneyTransferred(`${this.id.value}#${this.sent}`, this.id.value, to.value, amount.cents, amount.currency));
  }

  /** Credits a transfer once; a transfer already credited is ignored. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.received.includes(transferId)) return;
    this.deposit(amount);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sent: this.sent, received: this.received, sentDay: this.sentDay, sentOnDay: this.sentOnDay };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
