import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export type MovementKind = 'deposit' | 'withdrawal' | 'transfer-out' | 'transfer-in';

/** One entry in an account's history; counterpart is the other account's id for transfers. */
export interface Movement {
  readonly kind: MovementKind;
  readonly amount: number;
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  readonly movements: readonly Movement[];
}

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
    private history: readonly Movement[] = [],
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    return new Account(state.id, state.owner, state.currency, state.balance, state.movements);
  }

  get balance(): Money {
    return this.current;
  }

  /** Movements, newest first. */
  get movements(): readonly Movement[] {
    return [...this.history].reverse();
  }

  deposit(amount: Money, from: AccountId | null = null): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.record(from === null ? 'deposit' : 'transfer-in', amount, from);
  }

  withdraw(amount: Money, to: AccountId | null = null): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
    this.record(to === null ? 'withdrawal' : 'transfer-out', amount, to);
  }

  private record(kind: MovementKind, amount: Money, other: AccountId | null): void {
    this.history = [...this.history, { kind, amount: amount.amount(), counterpart: other === null ? null : other.value }];
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, movements: this.history };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
