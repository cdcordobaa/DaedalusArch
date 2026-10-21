import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { LedgerError } from '../LedgerError';
import { AccountOpened } from './events/AccountOpened';
import type { AccountId } from './value-objects/AccountId';

export interface Movement {
  readonly kind: string;
  readonly cents: number;
  readonly counterpart: string | null;
}

export interface AccountState {
  readonly id: AccountId;
  readonly owner: string;
  readonly currency: string;
  readonly balance: Money;
  readonly movements?: readonly Movement[];
}

/** A customer's account. Its balance never goes below zero. */
export class Account {
  private pending: DomainEvent[] = [];
  private movements: Movement[] = [];

  private constructor(
    readonly id: AccountId,
    readonly owner: string,
    readonly currency: string,
    private current: Money,
  ) {}

  static open(id: AccountId, owner: string, currency: string): Account {
    const account = new Account(id, owner, currency, Money.zero(currency));
    account.pending.push(new AccountOpened(id.value, owner));
    return account;
  }

  static restore(state: AccountState): Account {
    const account = new Account(state.id, state.owner, state.currency, state.balance);
    account.movements = [...(state.movements ?? [])];
    return account;
  }

  get balance(): Money {
    return this.current;
  }

  deposit(amount: Money, kind = 'deposit', counterpart: string | null = null): void {
    if (!amount.isPositive()) throw new LedgerError('a deposit must be positive');
    this.current = this.current.plus(amount);
    this.movements.push({ kind, cents: amount.cents, counterpart });
  }

  withdraw(amount: Money, kind = 'withdrawal', counterpart: string | null = null): void {
    if (!amount.isPositive()) throw new LedgerError('a withdrawal must be positive');
    const after = this.current.minus(amount);
    if (after.isNegative()) throw new LedgerError(`insufficient funds: short by ${Money.zero(this.currency).minus(after).format()}`);
    this.current = after;
    this.movements.push({ kind, cents: amount.cents, counterpart });
  }

  statement(): Movement[] {
    return [...this.movements].reverse();
  }

  state(): AccountState {
    return { id: this.id, owner: this.owner, currency: this.currency, balance: this.current, movements: [...this.movements] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
