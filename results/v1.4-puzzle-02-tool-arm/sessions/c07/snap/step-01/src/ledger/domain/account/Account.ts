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
  /** Transfers this account has sent. */
  readonly sent?: number;
  /** Ids of incoming transfers already applied. */
  readonly received?: readonly string[];
}

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
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.sent ?? 0, state.received ?? []);
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

  /** Takes the money out and records the transfer; the receiving account applies it on the event. */
  transferOut(amount: Money, to: AccountId): void {
    this.withdraw(amount);
    this.sent += 1;
    this.pending.push(new MoneyTransferred(`${this.id.value}#${this.sent}`, this.id.value, to.value, amount));
  }

  /** Applies an incoming transfer once; a repeated delivery changes nothing. */
  receiveTransfer(transferId: string, amount: Money): void {
    if (this.received.includes(transferId)) return;
    this.deposit(amount);
    this.received = [...this.received, transferId];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, sent: this.sent, received: this.received };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
