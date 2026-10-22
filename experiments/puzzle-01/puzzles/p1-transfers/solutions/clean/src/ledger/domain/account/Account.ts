import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import { TransferSent } from './events/TransferSent';
import type { Movement } from './Movement';
import type { AccountId } from './value-objects/AccountId';

/** Money an account may send by transfer per calendar day. */
export const DAILY_TRANSFER_LIMIT = 1000;

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  readonly sentDay: string | null;
  readonly sentThatDay: Money;
  readonly received: readonly string[];
  readonly movements: readonly Movement[];
}

/**
 * A customer's account. Its balance never goes below zero, and it never sends more than the daily transfer limit in
 * one calendar day.
 */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private sentDay: string | null,
    private sentThatDay: Money,
    private received: string[],
    private movements: Movement[],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency), null, Money.zero(currency), [], []);
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sentDay, state.sentThatDay, [...state.received], [...state.movements]);
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.movements.push({ kind: 'deposit', cents: amount.cents, counterpart: null });
  }

  withdraw(amount: Money): void {
    this.takeOut(amount, 'a withdrawal must be positive');
    this.movements.push({ kind: 'withdrawal', cents: amount.cents, counterpart: null });
  }

  /** Sends money to another account of the same currency; the destination is credited when the event is delivered. */
  sendTransfer(transferId: string, to: AccountId, toCurrency: string, amount: Money, day: string): void {
    if (to.equals(this.id)) throw new LedgerError('a transfer needs two different accounts');
    if (toCurrency !== this.currency) throw new LedgerError(`currency mismatch: ${this.currency} to ${toCurrency}`);
    const sentToday = this.sentDay === day ? this.sentThatDay : Money.zero(this.currency);
    const left = Money.of(DAILY_TRANSFER_LIMIT, this.currency).minus(sentToday);
    if (left.minus(amount).isNegative()) throw new LedgerError(`daily transfer limit reached: ${left.format()} left today`);
    this.takeOut(amount, 'a transfer must be positive');
    this.sentDay = day;
    this.sentThatDay = sentToday.plus(amount);
    this.movements.push({ kind: 'transfer-out', cents: amount.cents, counterpart: to.value });
    this.pending.push(new TransferSent(transferId, this.id.value, to.value, amount.cents, this.currency));
  }

  /** Credits an incoming transfer once, whatever the number of deliveries. */
  receiveTransfer(transferId: string, from: AccountId, amount: Money): void {
    if (this.received.includes(transferId)) return;
    this.received.push(transferId);
    this.current = this.current.plus(amount);
    this.movements.push({ kind: 'transfer-in', cents: amount.cents, counterpart: from.value });
  }

  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  state(): AccountState {
    return {
      id: this.id, owner: this.owner, currency: this.currency, balance: this.current,
      sentDay: this.sentDay, sentThatDay: this.sentThatDay, received: [...this.received], movements: [...this.movements],
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private takeOut(amount: Money, notPositive: string): void {
    if (!amount.isPositive()) throw new LedgerError(notPositive);
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
  }
}
